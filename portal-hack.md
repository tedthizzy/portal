# Portal + MagSafe Rotation Auth

## Portal Primitives

**Stack**: Nostr (identity) + Lightning (payments) + WebSocket (relay)

**Core Flow**:
```
Backend → Portal Server → User's Wallet App
```

**Key Operations**:
- `newKeyHandshakeUrl()` → QR/deeplink for auth (returns user's pubkey)
- `requestSinglePayment()` → one-time Lightning invoice (millisats)
- `requestRecurringPayment()` → subscription w/ recurrence rules
- `authenticateKey()` → verify Nostr pubkey owns private key
- `requestInvoice()` → generate Lightning invoice for payment

**Identity**: User's Nostr pubkey = permanent ID (no passwords, no OAuth, no servers)
**Payments**: Lightning Network = instant settlement, ~0 fees, micropayments viable
**Auth Token**: JWT issued via `issueJwt(targetKey, durationHours)` for session mgmt

**SDK Install**: `npm install portal-sdk`

## MagSafe Rotation Detection

**Goal**: Detect intentional twist gesture while iPhone magnetically docked → confirm Portal action

**No Public API**: Must infer rotation from sensors (gyro/magnetometer)

### Sensor Stack (iOS CoreMotion)

**Primary**: `CMMotionManager.deviceMotion` @ 100 Hz
- Gyroscope: rotation rate (rad/s) around device axes
- Accelerometer: linear acceleration (g) for stationarity gate
- Magnetometer: field strength (µT) for "attached" detection

**Attachment Gate**: `|B| - baseline > 30-60 µT` → magnet present
**Stationarity Gate**: accel RMS < 0.02-0.04g over 200ms → not moving/walking

### Twist Detection Logic

**Integration**: Accumulate `gyro.z * dt` → cumulative angle Δθ
**Detents**: Quantize angle into steps (e.g., 12 detents @ 30° = full rotation)

```swift
if |B|-B0 > thresh && accelRMS < thresh {
    omegaZ = gyro.z - bias
    if |omegaZ| > 30°/s { integrating = true }
    angleAccum += omegaZ * dt
    if |angleAccum| >= 30° {
        detents += (angleAccum > 0) ? +1 : -1
        angleAccum = 0
        haptic()
    }
}
```

**Gesture Mapping**:
- 2 CW detents within 3s → **Confirm**
- 1 CCW detent → **Cancel**
- Timeout after 5s idle

**Calibration**: 1-tap button → capture 1s baseline (gyro bias, mag baseline)

### False Positive Defense

- Require **both** mag attachment AND stationarity
- Min angular velocity threshold (30°/s)
- Dwell period (50-100ms) between detents
- Cancel if tilt changes >5-8° (phone picked up)

### Magnetometer Alternative (Advanced)

**Approach**: Track B-field rotation in XY plane via `atan2(By, Bx)`
**Requirement**: Asymmetric magnet (off-center or orientation magnet) to break rotational symmetry
**Advantage**: Works even if phone stationary (no gyro integration drift)
**Disadvantage**: Sensitive to interference, needs per-device calibration

## Portal + Rotation Integration

### Use Case 1: Payment Confirmation

**Flow**:
1. Backend calls `client.requestSinglePayment(userKey, [], {amount: 1000, ...})`
2. User's Portal app shows payment request
3. User places iPhone on MagSafe mount
4. Twist 2 clicks CW → payment approved → Lightning invoice paid
5. Backend receives `status: 'paid'` notification via WebSocket

**Code**:
```typescript
const client = new PortalSDK({ serverUrl: 'wss://...' });
await client.connect();
await client.authenticate(token);

client.requestSinglePayment(userKey, [], {
  amount: 1000,
  currency: Currency.Millisats,
  description: "Confirm purchase"
}, (status) => {
  if (status.status === 'user_approved') {
    // iOS app detected: twist gesture started
    showRotationUI(); 
  }
  if (status.status === 'paid') {
    // Twist completed → payment settled
    unlockContent();
  }
});
```

### Use Case 2: Auth Handshake

**Flow**:
1. Backend generates `newKeyHandshakeUrl(callback)`
2. User scans QR → Portal app opens
3. Place on MagSafe + twist → confirm key handshake
4. Backend receives user's pubkey via callback
5. Issue JWT for session

**Why Better Than Tap**: Physical rotation = harder to phish, more intentional, delightful UX

### Use Case 3: Subscription Authorization

**Flow**: `requestRecurringPayment()` → user reviews terms → twist to authorize recurring charge
**Security**: Rotation gesture = high-friction confirmation for high-value action

## Implementation Plan

### iOS App (Swift)

**Dependencies**: CoreMotion, Portal SDK (if native), WebSocket client

**Components**:
1. `RotationDetector`: sensor fusion + detent logic
2. `PortalClient`: WebSocket wrapper for Portal protocol
3. `ConfirmationUI`: visual ring that fills per detent, haptics

**State Machine**:
```
Idle → Attached (mag gate) → Armed (stationarity) → Integrating (rotation) → Detent → Confirm
```

**Key Thresholds** (tune via testing):
- Mag attach: +40 µT delta
- Stationarity: <0.03g RMS
- Angular velocity: >30°/s
- Detent angle: 30°
- Confirm detents: 2 CW
- Timeout: 3s

### Backend Integration

**Portal Server Setup**: Get auth token from Portal dashboard
**WebSocket**: Maintain persistent connection for real-time status updates
**Payment Flow**: 
1. Generate payment request
2. Listen for `payment_status_update` notifications
3. Map `user_approved` → prompt rotation in app
4. Map `paid` → fulfill order

### Security Considerations

**Anti-Replay**: Each payment has unique `request_id`, can't reuse
**Intent Verification**: Rotation gesture = stronger signal than tap (2-factor: crypto + physical)
**Timeout**: Payment expires after N seconds (set via `expires_at`)
**Amount Display**: Always show amount in both sats and fiat before rotation prompt

## Hardware Requirements

**Minimal**: Any MagSafe-compatible magnetic ring/mount (~$5-15)
**Optimal**: Off-center magnet taped to mount for magnetometer mode
**Phone**: iPhone 12+ (has MagSafe ring), iOS 14+ for CoreMotion APIs

## Implementation: React Native + Expo (Not Swift)

**Discovery**: Portal app is React Native + Expo (verified from .app bundle)
**Sensors**: `expo-sensors` provides Gyroscope, Accelerometer, Magnetometer
**Advantage**: TypeScript aligns with portal-sdk, cross-platform, hot reload

**POC Location**: `/Users/ted/Projects/portal/rotation-poc/`
**Stack**: React Native + Expo + TypeScript
**Run**: `cd rotation-poc && npx expo start` (scan QR with Expo Go app)

## Metrics & Tuning

**Latency**: First rotation → detent haptic < 150ms
**False Positive Rate**: <0.5 detents/min while idle/mounted
**Miss Rate**: <1 missed detent per full 360° rotation
**Calibration Drift**: Re-cal every 5-10 minutes or on >10% mag field change

## Edge Cases

**Case on phone**: Recalibrate baseline with case attached
**Car mount vibration**: Increase stationarity threshold or disable in motion
**Metal desk**: May interfere with magnetometer; use gyro-only mode
**Background**: iOS suspends sensors; require foreground for gesture detection

## Demo Flow (2-hour POC)

1. Show Lightning payment request (100 sats)
2. Tap "Calibrate" → place on MagSafe mount
3. UI shows "Attached" + rotation ring graphic
4. Twist phone 2 clicks → haptic feedback per detent
5. UI animates "Confirmed" → payment settles
6. Show `preimage` hash (proof of payment)

## Next Steps

**Phase 1**: Gyro-based twist detection + mock Portal payments
**Phase 2**: Integrate real Portal SDK (auth + single payments)
**Phase 3**: Magnetometer mode for stationary confirmation
**Phase 4**: Recurring payment authorization flow
**Phase 5**: BLE bridge to iOS app from web/desktop app

## Resources

- Portal SDK: `portal-sdk` npm package
- Portal Docs: https://docs.portalhq.io
- CoreMotion: CMMotionManager, CMDeviceMotion
- Lightning: 1 sat = 1000 millisats, ~$0.0003 USD

