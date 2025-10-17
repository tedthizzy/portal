# Portal + MagSafe Rotation Authentication

Proof-of-concept for authenticating Lightning Network payments using physical rotation gestures detected via iPhone's MagSafe sensors.

Replace tap-to-confirm with **twist-to-pay**: Users place their iPhone on a MagSafe mount and physically rotate it to approve Portal payments.

**Status**: Phase 1 complete - live sensor visualization working

---

## Quick Start

### Prerequisites

- **iPhone 12+** with MagSafe
- **Mac** with Node.js
- **MagSafe mount/ring** (any $5 magnetic puck works)
- **WiFi network** (both devices on same network)

### Setup (5 minutes)

**1. Install Expo Go on iPhone**

Download from App Store: [Expo Go](https://apps.apple.com/app/expo-go/id982107779)

**2. Install Dependencies**

```bash
cd /Users/ted/Projects/portal
npm install
```

**3. Network Setup**

**Important**: Both devices must be on same WiFi.

If using iPhone tethering:
- Disconnect tethering temporarily
- Connect both to same WiFi
- Can re-enable tethering after testing

**4. Start Dev Server**

```bash
npm start
```

You'll see a QR code in the terminal.

**5. Load on iPhone**

1. Open **Camera app** (not Expo Go directly)
2. Point at QR code on Mac screen
3. Tap notification → opens in Expo Go

### What You Should See

**App Title**: "Rotation Detection POC"

**Three Sensor Boxes** (updating at ~100 Hz):
- **Gyroscope** - rotation rate (rad/s)
- **Accelerometer** - linear acceleration (g)
- **Magnetometer** - magnetic field (µT)

### Quick Tests

**Test 1: Gyroscope**
- Hold phone flat, rotate clockwise → `Z` value goes negative
- Rotate counter-clockwise → `Z` value goes positive
- **Expected**: Values between -5 and +5 rad/s

**Test 2: Magnetometer** ⭐ Most Important
1. Note baseline `|B|` value (typically 30-60 µT)
2. Place phone on MagSafe mount
3. `|B|` should jump by +40-100 µT
4. Remove from mount → returns to baseline

**Test 3: Accelerometer**
- Hold still → `|a|` ≈ 1.0g
- Walk around → `|a|` oscillates
- Shake → `|a|` spikes above 1.2g

### Troubleshooting

**"No usable data found" when scanning**
- Install Expo Go from App Store first
- Use Camera app to scan, not QR reader

**"Internet connection appears offline"**
- Verify both devices on same WiFi (not tethering)
- Restart Expo: Ctrl+C, then `npm start`

**Sensors show zeros**
- Must use physical device (not simulator)
- Try restarting app (shake phone → reload)

**Port 8081 already in use**
```bash
lsof -ti:8081 | xargs kill -9
npm start
```

---

## Why This Matters

**Current UX**: Tap to approve payment (easy to phish, pocket taps)  
**New UX**: Physical rotation on MagSafe mount (hardware + gesture = 2FA)

**Security Benefits**:
- Harder to phish (requires physical device + mount + correct gesture)
- Prevents accidental approvals
- Delightful haptic feedback
- Could become Portal's signature interaction

---

## Project Structure

```
portal/
├── README.md              # This file (quickstart)
├── REFERENCE.md           # Technical documentation
├── App.tsx                # React Native app (Phase 1)
├── package.json           # All dependencies
├── app.json               # Expo config
├── tsconfig.json
└── assets/
```

---

## Technical Stack

- **Portal SDK**: Nostr (identity) + Lightning (payments) + WebSocket
- **Rotation Detection**: React Native + Expo + expo-sensors
- **Sensors**: Gyroscope, Accelerometer, Magnetometer at 100 Hz

Portal's mobile app is React Native + Expo (verified via bundle analysis), so this POC aligns perfectly.

---

## Implementation Progress

- [x] Phase 1: Live sensor visualization (100 Hz)
- [ ] Phase 2: MagSafe attachment detection
- [ ] Phase 3: Stationarity gate
- [ ] Phase 4: Rotation integration
- [ ] Phase 5: Detent logic + haptics (tactile clicks)
- [ ] Phase 6: Gesture recognition (2 CW = confirm)
- [ ] Phase 7: Portal SDK integration (real Lightning payments)

---

## Demo Vision

Place iPhone on MagSafe → rotate 60° clockwise (2 haptic "clicks") → payment approved → Lightning invoice paid instantly.

---

## Resources

- [Portal SDK](https://www.npmjs.com/package/portal-sdk) - TypeScript client
- [Portal App](https://apps.apple.com/us/app/portal-digital-wallet/id6748541067) - iOS/Android wallet
- [REFERENCE.md](./REFERENCE.md) - Technical implementation details
- [Expo Sensors](https://docs.expo.dev/versions/latest/sdk/sensors/) - API docs

---

## Next Steps

Once Phase 1 works on your device:
1. Report baseline `|B|` reading (µT)
2. Report MagSafe spike magnitude (µT)
3. Ready for Phase 2 (attachment detection logic)

See [REFERENCE.md](./REFERENCE.md) for full technical documentation.

---

## License

MIT
