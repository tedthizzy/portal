# Portal + Rotation POC - Quick Start

## What We Built

1. **portal-hack.md** - Technical deep-dive on Portal SDK + MagSafe rotation detection
2. **rotation-poc/** - Working React Native app (Phase 1: sensor visualization)
3. **ROTATION_POC.md** - 7-phase implementation plan

## Run the POC Right Now

```bash
cd /Users/ted/Projects/portal/rotation-poc
npx expo start
```

Then:
1. Open Expo Go app on your iPhone
2. Scan QR code with Camera app
3. See live sensor data updating at 100 Hz

## What to Test

**Gyroscope**: Rotate phone clockwise/counter-clockwise → watch `Z` value
**Magnetometer**: Place on MagSafe mount → watch `|B|` spike
**Accelerometer**: Hold still vs walking → watch `|a|` change

## Key Discovery: Portal is React Native

Portal app bundle analysis revealed:
- `main.jsbundle` ← React Native
- `Expo*.bundle` files ← Expo SDK
- `React-Core_privacy.bundle` ← React Native core

**This means**: You can build rotation detection in TypeScript/React Native, exactly how Portal is built.

## Project Structure

```
portal/
├── portal-hack.md           # Technical reference (214 lines)
├── ROTATION_POC.md          # Implementation plan (7 phases)
├── QUICKSTART.md            # This file
├── rotation-poc/            # React Native app
│   ├── App.tsx              # Phase 1: Live sensors
│   ├── package.json
│   └── README.md
└── package.json             # portal-sdk installed
```

## Next Steps (In Order)

### Immediate (Test sensors work)
```bash
cd rotation-poc
npx expo start
# Verify gyro.z changes when you rotate phone
# Verify |B| spikes when placed on MagSafe
```

### Phase 2 (30 min)
Add attachment detection:
- Calibration button
- Green/red banner when MagSafe detected
- Threshold tuning

### Phase 3 (30 min)  
Add stationarity gate:
- RMS calculation over 200ms window
- Disable rotation integration when moving

### Phase 4 (45 min)
Add rotation integration:
- Integrate gyro.z over time → cumulative angle
- Display angle in degrees

### Phase 5 (45 min)
Add detent logic:
- Trigger haptic every 30°
- Count clockwise vs counter-clockwise

### Phase 6 (30 min)
Add gesture recognition:
- 2 CW detents = Confirm
- 1 CCW detent = Cancel
- 3s timeout window

### Phase 7 (Later)
Integrate with Portal SDK:
- Connect to Portal WebSocket
- Map confirm → `requestSinglePayment` approval
- Show real Lightning invoice

## Why This Matters

**Current UX**: Tap to approve payment (easy to phish, accidental clicks)
**New UX**: Twist phone 2 clicks on MagSafe mount (physical proof of intent)

**Security Benefits**:
- Harder to phish (requires physical device + mount)
- Prevents pocket taps
- Delightful haptic feedback
- Could become Portal's signature interaction

## Portal SDK Basics

```typescript
import { PortalSDK, Currency } from 'portal-sdk';

const client = new PortalSDK({ serverUrl: 'wss://...' });
await client.connect();
await client.authenticate(token);

// Request payment
client.requestSinglePayment(userKey, [], {
  amount: 1000,
  currency: Currency.Millisats,
  description: "Coffee"
}, (status) => {
  if (status.status === 'paid') {
    console.log('Payment received!');
  }
});
```

## Resources

- Portal SDK: `npm install portal-sdk` (already installed)
- Portal App: https://apps.apple.com/us/app/portal-digital-wallet/id6748541067
- Expo Sensors: https://docs.expo.dev/versions/latest/sdk/sensors/
- Lightning: 1 sat = 1000 millisats ≈ $0.0003 USD

