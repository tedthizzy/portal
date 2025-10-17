# Technical Reference: Portal + MagSafe Rotation Authentication

Complete technical documentation for implementing rotation-based payment confirmation with Portal.

## Table of Contents

1. [Portal SDK Overview](#portal-sdk-overview)
2. [Rotation Detection Theory](#rotation-detection-theory)
3. [Implementation Phases](#implementation-phases)
4. [Sensor Thresholds](#sensor-thresholds)
5. [Integration Examples](#integration-examples)

---

## Portal SDK Overview

### Architecture

**Stack**: Nostr (identity) + Lightning Network (payments) + WebSocket (relay)

```
Backend ←→ Portal Server ←→ User's Wallet App
   ↓         (relay)            ↓
Node.js                    React Native
```

### Core Concepts

**Identity**: Nostr public key (no passwords, no OAuth, decentralized)
**Payments**: Lightning Network (instant, ~0 fees, micropayments)
**Auth**: JWT tokens for session management
**Communication**: WebSocket for real-time payment status updates

### Key API Methods

```typescript
import { PortalSDK, Currency, Timestamp } from 'portal-sdk';

const client = new PortalSDK({
  serverUrl: 'wss://portal-server-url',
  connectTimeout: 10000
});

await client.connect();
await client.authenticate('your-auth-token');

// Generate auth URL (returns Nostr pubkey)
const url = await client.newKeyHandshakeUrl((mainKey, preferredRelays) => {
  console.log('User authenticated:', mainKey);
});

// Request single payment
await client.requestSinglePayment(userPubkey, [], {
  amount: 1000,                    // millisats
  currency: Currency.Millisats,
  description: "Coffee purchase"
}, (status) => {
  if (status.status === 'paid') {
    console.log('Payment received!', status.preimage);
  }
});

// Request recurring payment (subscription)
await client.requestRecurringPayment(userPubkey, [], {
  amount: 10000,
  currency: Currency.Millisats,
  recurrence: {
    calendar: "monthly",
    first_payment_due: Timestamp.fromNow(86400),
    max_payments: 12
  },
  expires_at: Timestamp.fromNow(3600)
});
```

### Payment States

- `user_approved` - User saw request, starting confirmation
- `user_success` - User confirmed
- `paid` - Lightning invoice settled (payment complete)
- `user_rejected` - User declined
- `timeout` - Expired before confirmation
- `error` - Technical failure

---

## Rotation Detection Theory

### Why Rotation?

**Problem**: Tap-to-confirm is vulnerable to:
- Accidental pocket taps
- Phishing attacks
- Muscle memory (unconscious approval)

**Solution**: Physical rotation on MagSafe mount = **two-factor confirmation**:
1. Cryptographic proof (Nostr signature)
2. Physical proof (gesture on mounted device)

### Sensor Fusion

**Gyroscope** (primary):
- Measures angular velocity (rad/s) around device axes
- Z-axis = rotation perpendicular to screen
- Integrate over time: ∫ω dt = angle

**Magnetometer** (attachment detection):
- Measures magnetic field strength (µT)
- MagSafe magnets cause 40-100 µT spike
- Gate: only detect rotation when |B| above threshold

**Accelerometer** (stationarity gate):
- Measures linear acceleration (g)
- RMS < 0.03g = phone is still
- Prevents false rotations when walking/moving

### Detection Algorithm

```typescript
// Pseudocode
const DETENT_ANGLE = 30; // degrees
const OMEGA_MIN = 30;    // deg/s
const MAG_THRESH = 40;   // µT above baseline

let angleAccum = 0;
let detentCount = 0;

function onSensorUpdate(gyro, accel, mag) {
  const isAttached = (mag.magnitude - baseline) > MAG_THRESH;
  const isStationary = calculateRMS(accel) < 0.03;
  const omega_z = gyro.z - gyroBias;
  
  if (isAttached && isStationary && Math.abs(omega_z) > OMEGA_MIN) {
    angleAccum += omega_z * dt;
    
    if (Math.abs(angleAccum) >= DETENT_ANGLE) {
      detentCount += (angleAccum > 0) ? 1 : -1;
      angleAccum = 0;
      triggerHaptic();
      
      if (detentCount >= 2) {
        confirmPayment();
      } else if (detentCount <= -1) {
        cancelPayment();
      }
    }
  }
}
```

### Gesture Vocabulary

- **2 CW detents** (60° clockwise) → Confirm
- **1 CCW detent** (30° counter-clockwise) → Cancel
- **Timeout** after 3-5 seconds → Reset
- **Pickup detection** (tilt > 8°) → Cancel gesture

---

## Implementation Phases

### Phase 1: Sensor Visualization ✅

**Goal**: Verify sensor access and baseline readings

```tsx
import { Gyroscope, Accelerometer, Magnetometer } from 'expo-sensors';

useEffect(() => {
  Gyroscope.setUpdateInterval(10); // 100 Hz
  const sub = Gyroscope.addListener(data => {
    console.log('Gyro Z:', data.z); // rotation rate
  });
  return () => sub.remove();
}, []);
```

**Success Criteria**:
- All sensors update at ~100 Hz
- Gyro.z changes when rotating phone
- Mag magnitude spikes on MagSafe mount

### Phase 2: Attachment Detection

**Goal**: Detect when phone is on MagSafe mount

```tsx
const [isAttached, setIsAttached] = useState(false);
const [magBaseline, setMagBaseline] = useState(50);

Magnetometer.addListener(({ x, y, z }) => {
  const magnitude = Math.sqrt(x*x + y*y + z*z);
  const delta = magnitude - magBaseline;
  setIsAttached(delta > 40); // 40 µT threshold
});
```

**Calibration**:
- Button to capture 1-second baseline
- Store average |B| when phone on desk
- Dynamic threshold adjustment

### Phase 3: Stationarity Gate

**Goal**: Only integrate rotation when phone is still

```tsx
const accelWindow = useRef<number[]>([]);

Accelerometer.addListener(({ x, y, z }) => {
  const mag = Math.sqrt(x*x + y*y + z*z);
  accelWindow.current.push(mag);
  
  if (accelWindow.current.length > 20) { // 200ms @ 100Hz
    accelWindow.current.shift();
  }
  
  // Root-mean-square
  const rms = Math.sqrt(
    accelWindow.current.reduce((sum, v) => sum + v*v, 0) / 
    accelWindow.current.length
  );
  
  setIsStationary(rms < 0.03);
});
```

### Phase 4: Rotation Integration

**Goal**: Accumulate gyro readings into angle

```tsx
const angleAccum = useRef(0);
const lastTime = useRef(Date.now());
const gyroBias = useRef(0);

Gyroscope.addListener(({ z }) => {
  const now = Date.now();
  const dt = (now - lastTime.current) / 1000; // seconds
  lastTime.current = now;
  
  if (isAttached && isStationary) {
    const omega = z - gyroBias.current; // rad/s
    if (Math.abs(omega) > 0.52) { // 30 deg/s in rad/s
      angleAccum.current += omega * dt;
    }
  }
});
```

### Phase 5: Detent Logic + Haptics

**Goal**: Quantize rotation into discrete clicks

```tsx
import * as Haptics from 'expo-haptics';

const DETENT = (30 * Math.PI) / 180; // 30° in radians
const [detents, setDetents] = useState(0);

// In rotation loop:
if (Math.abs(angleAccum.current) >= DETENT) {
  const direction = angleAccum.current > 0 ? 1 : -1;
  setDetents(prev => prev + direction);
  angleAccum.current = 0;
  
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
```

**Haptic Patterns**:
- Medium impact on each detent
- Heavy impact on confirm/cancel
- Light impact on attach/detach

### Phase 6: Gesture Recognition

**Goal**: Map detents to actions

```tsx
const detentHistory = useRef<{count: number, time: number}[]>([]);

useEffect(() => {
  const now = Date.now();
  detentHistory.current.push({ count: detents, time: now });
  
  // Keep only recent 3 seconds
  detentHistory.current = detentHistory.current.filter(
    d => now - d.time < 3000
  );
  
  const total = detentHistory.current.reduce((sum, d) => sum + d.count, 0);
  
  if (total >= 2) {
    onConfirm();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetGesture();
  } else if (total <= -1) {
    onCancel();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    resetGesture();
  }
}, [detents]);
```

### Phase 7: Portal Integration

**Goal**: Connect gesture to real Lightning payments

```tsx
// Backend requests payment
const paymentRequest = await client.requestSinglePayment(
  userPubkey, [], 
  { amount: 1000, currency: Currency.Millisats, description: "Purchase" },
  (status) => {
    if (status.status === 'user_approved') {
      // Show rotation prompt in mobile app
      showRotationUI();
    }
  }
);

// Mobile app: on rotation confirm
function onRotationConfirm() {
  // Payment automatically proceeds via Portal's flow
  // Backend receives 'paid' notification
}
```

---

## Sensor Thresholds

### Default Values (Tune Per Device)

```typescript
const THRESHOLDS = {
  // Magnetometer
  MAG_ATTACH_DELTA: 40,        // µT above baseline
  MAG_DETACH_DELTA: 20,        // µT below baseline (hysteresis)
  
  // Accelerometer
  STATIONARY_RMS: 0.03,        // g units
  STATIONARY_WINDOW: 200,      // ms
  
  // Gyroscope
  OMEGA_MIN: 30,               // deg/s (0.52 rad/s)
  OMEGA_STOP: 10,              // deg/s to end integration
  GYRO_BIAS_SAMPLES: 100,      // 1 second @ 100 Hz
  
  // Detents
  DETENT_ANGLE: 30,            // degrees
  DWELL_TIME: 75,              // ms between detents
  
  // Gesture
  GESTURE_WINDOW: 3000,        // ms to complete gesture
  CONFIRM_DETENTS: 2,          // clockwise
  CANCEL_DETENTS: -1,          // counter-clockwise
  
  // Tilt detection
  TILT_THRESHOLD: 8,           // degrees from calibration
};
```

### Calibration Process

```typescript
async function calibrate() {
  const gyroSamples: number[] = [];
  const magSamples: number[] = [];
  
  const gyroSub = Gyroscope.addListener(({ z }) => {
    gyroSamples.push(z);
  });
  
  const magSub = Magnetometer.addListener(({ x, y, z }) => {
    magSamples.push(Math.sqrt(x*x + y*y + z*z));
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  gyroBias.current = average(gyroSamples);
  magBaseline.current = average(magSamples);
  
  gyroSub.remove();
  magSub.remove();
}
```

---

## Integration Examples

### Complete Payment Flow

```typescript
// ===== BACKEND (Node.js) =====
import { PortalSDK, Currency } from 'portal-sdk';

const client = new PortalSDK({ serverUrl: 'wss://portal.example.com' });
await client.connect();
await client.authenticate(process.env.PORTAL_TOKEN);

// User initiates checkout
app.post('/api/checkout', async (req, res) => {
  const { userPubkey, amount } = req.body;
  
  let paymentStatus = null;
  
  await client.requestSinglePayment(
    userPubkey,
    [],
    {
      amount: amount * 1000, // convert sats to millisats
      currency: Currency.Millisats,
      description: `Order #${req.body.orderId}`
    },
    (status) => {
      paymentStatus = status;
      
      if (status.status === 'user_approved') {
        // Notify mobile app to show rotation UI
        notifyMobileApp(userPubkey, 'SHOW_ROTATION_PROMPT');
      }
      
      if (status.status === 'paid') {
        // Payment complete! Fulfill order
        fulfillOrder(req.body.orderId, status.preimage);
      }
    }
  );
  
  res.json({ paymentRequestId: /* ... */ });
});

// ===== MOBILE APP (React Native) =====
import { useRotationDetector } from './hooks/useRotationDetector';

function PaymentConfirmScreen({ amount, description }) {
  const { detents, isAttached, isStationary } = useRotationDetector({
    onConfirm: () => {
      // Rotation gesture complete → approve payment
      approvePayment();
    },
    onCancel: () => {
      // Cancel gesture → reject payment
      rejectPayment();
    }
  });
  
  return (
    <View>
      <Text>Amount: {amount} sats</Text>
      <Text>{description}</Text>
      
      {!isAttached && (
        <Text>Place phone on MagSafe mount</Text>
      )}
      
      {isAttached && (
        <>
          <RotationRing progress={detents / 2} />
          <Text>Rotate clockwise to confirm</Text>
        </>
      )}
    </View>
  );
}
```

### Authentication Flow

```typescript
// Generate auth URL
const authUrl = await client.newKeyHandshakeUrl((mainKey, relays) => {
  console.log('User authenticated with pubkey:', mainKey);
  
  // Issue JWT for session
  const jwt = await client.issueJwt(mainKey, 24); // 24 hours
  
  // Store in database
  await db.sessions.create({
    pubkey: mainKey,
    token: jwt,
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
  });
});

// Show QR code or deep link
res.json({ authUrl });

// Later: verify JWT
const claims = await client.verifyJwt(publicKey, jwtToken);
const user = await db.users.findByPubkey(claims.targetKey);
```

---

## Hardware Requirements

**Phone**: iPhone 12+ (MagSafe support)
**Mount**: Any MagSafe-compatible ring/puck (~$5-15)
**OS**: iOS 15+ (for expo-sensors support)
**Network**: WiFi for development (Expo Go)

**Optional Enhancements**:
- Off-center magnet on mount (improves magnetometer mode)
- Popsocket-style mount (better ergonomics)
- Car mount (requires higher stationarity threshold)

---

## Performance Targets

**Latency**: First rotation → detent haptic < 150ms
**False Positive Rate**: < 0.5 detents/min while idle and mounted
**Miss Rate**: < 1 missed detent per full 360° rotation
**Calibration Drift**: Re-calibrate every 5-10 minutes
**Battery Impact**: < 5% per hour (with screen on)

---

## Future Enhancements

**Magnetometer Mode**: Use B-field rotation instead of gyro (requires asymmetric magnet)
**BLE Bridge**: Control desktop app payments from phone rotation
**Multi-Detent Vocabulary**: Different gestures for different actions (3 clicks = large amount, etc.)
**Biometric Combo**: Rotation + Face ID for high-value transactions
**NFC Trigger**: Tap phone to NFC tag → auto-open rotation confirm screen

---

## Resources

- [Portal SDK npm](https://www.npmjs.com/package/portal-sdk)
- [Portal Docs](https://docs.portalhq.io)
- [Expo Sensors](https://docs.expo.dev/versions/latest/sdk/sensors/)
- [Lightning Network](https://lightning.network)
- [Nostr Protocol](https://nostr.com)

