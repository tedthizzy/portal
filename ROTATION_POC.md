# Rotation Detection POC - React Native + Expo

## Why This Stack

Portal app is React Native + Expo (verified from `.app` bundle inspection)
- `expo-sensors` provides Gyroscope, Accelerometer, Magnetometer APIs
- TypeScript aligns with portal-sdk
- Cross-platform (iOS + Android)
- Hot reload for fast iteration
- Can contribute back to Portal repo later

## Setup (5 minutes)

```bash
cd /Users/ted/Projects/portal
npx create-expo-app@latest rotation-poc --template blank-typescript
cd rotation-poc
npx expo install expo-sensors expo-haptics
```

## Core Dependencies

- `expo-sensors` - gyro/accel/mag access
- `expo-haptics` - haptic feedback on detents
- React Native built-ins for UI

## Implementation Plan

### Phase 1: Raw Sensor Visualization (30 min)

**Goal**: Display live gyro/accel/mag readings to verify sensor access

```tsx
import { Gyroscope, Accelerometer, Magnetometer } from 'expo-sensors';

// Subscribe at 100 Hz
Gyroscope.setUpdateInterval(10); // ms
Gyroscope.addListener(({ x, y, z }) => {
  // z = rotation around screen normal
  console.log('Gyro Z:', z);
});
```

**UI**: Simple text display of `omega_z`, `|accel|`, `|B|`

### Phase 2: Attachment Detection (30 min)

**Goal**: Detect when phone is on MagSafe mount

```tsx
const [isAttached, setIsAttached] = useState(false);
const [magBaseline, setMagBaseline] = useState(0);

Magnetometer.addListener(({ x, y, z }) => {
  const magnitude = Math.sqrt(x*x + y*y + z*z);
  const delta = magnitude - magBaseline;
  
  if (delta > 40) { // µT threshold
    setIsAttached(true);
  } else {
    setIsAttached(false);
  }
});
```

**UI**: Green banner when attached, red when not

### Phase 3: Stationarity Gate (30 min)

**Goal**: Only integrate rotation when phone is stationary

```tsx
const accelWindow = useRef<number[]>([]);

Accelerometer.addListener(({ x, y, z }) => {
  const magnitude = Math.sqrt(x*x + y*y + z*z);
  accelWindow.current.push(magnitude);
  
  if (accelWindow.current.length > 20) { // 200ms @ 100Hz
    accelWindow.current.shift();
  }
  
  const rms = calculateRMS(accelWindow.current);
  const isStationary = rms < 0.03; // g units
});
```

### Phase 4: Rotation Integration (45 min)

**Goal**: Integrate gyro.z to accumulate rotation angle

```tsx
const angleAccum = useRef(0);
const lastTimestamp = useRef(Date.now());
const gyroBias = useRef(0); // Set during calibration

Gyroscope.addListener(({ z }) => {
  const now = Date.now();
  const dt = (now - lastTimestamp.current) / 1000; // seconds
  lastTimestamp.current = now;
  
  const omega_z = z - gyroBias.current; // rad/s
  
  if (isAttached && isStationary && Math.abs(omega_z) > 0.52) { // 30°/s
    angleAccum.current += omega_z * dt;
  }
});
```

### Phase 5: Detent Logic (45 min)

**Goal**: Quantize rotation into discrete clicks with haptics

```tsx
import * as Haptics from 'expo-haptics';

const DETENT_ANGLE = 30 * (Math.PI / 180); // 30° in radians
const [detentCount, setDetentCount] = useState(0);

// In rotation integration loop:
if (Math.abs(angleAccum.current) >= DETENT_ANGLE) {
  const direction = angleAccum.current > 0 ? 1 : -1;
  
  setDetentCount(prev => prev + direction);
  angleAccum.current = 0; // Reset accumulator
  
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
```

**UI**: Circular progress ring that fills per detent

### Phase 6: Gesture Recognition (30 min)

**Goal**: Detect 2 CW clicks = Confirm, 1 CCW = Cancel

```tsx
const detentHistory = useRef<{count: number, time: number}[]>([]);
const GESTURE_WINDOW = 3000; // ms

useEffect(() => {
  const now = Date.now();
  detentHistory.current.push({ count: detentCount, time: now });
  
  // Keep only recent detents
  detentHistory.current = detentHistory.current.filter(
    d => now - d.time < GESTURE_WINDOW
  );
  
  const total = detentHistory.current.reduce((sum, d) => sum + d.count, 0);
  
  if (total >= 2) {
    onConfirm();
    resetGesture();
  } else if (total <= -1) {
    onCancel();
    resetGesture();
  }
}, [detentCount]);
```

### Phase 7: Calibration UI (30 min)

**Goal**: One-tap calibration for gyro bias + mag baseline

```tsx
const calibrate = async () => {
  const gyroSamples: number[] = [];
  const magSamples: number[] = [];
  
  const gyroSub = Gyroscope.addListener(({ z }) => {
    gyroSamples.push(z);
  });
  
  const magSub = Magnetometer.addListener(({ x, y, z }) => {
    magSamples.push(Math.sqrt(x*x + y*y + z*z));
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1 sec
  
  gyroBias.current = average(gyroSamples);
  magBaseline = average(magSamples);
  
  gyroSub.remove();
  magSub.remove();
};
```

**UI**: Button "Calibrate" → "Place on mount..." → "Calibrated ✓"

## File Structure

```
rotation-poc/
├── App.tsx                    # Main entry point
├── src/
│   ├── hooks/
│   │   ├── useRotationDetector.ts   # Core rotation logic
│   │   ├── useAttachmentGate.ts     # Magnetometer logic
│   │   └── useStationarityGate.ts   # Accelerometer logic
│   ├── components/
│   │   ├── RotationRing.tsx         # Circular progress UI
│   │   ├── StatusBanner.tsx         # Attached/Stationary status
│   │   └── CalibrationButton.tsx    # Calibration UI
│   └── utils/
│       ├── signalProcessing.ts      # RMS, averaging, filtering
│       └── constants.ts             # Thresholds, angles
└── package.json
```

## Testing Protocol

### Test 1: Sensor Access
- Run app on iPhone
- Verify all 3 sensors show live data
- Check update rate ~100 Hz

### Test 2: Attachment Detection  
- Calibrate baseline (phone on desk)
- Place on MagSafe mount → banner turns green
- Remove → banner turns red
- **Target**: <200ms latency, <5% false positives

### Test 3: Stationarity Gate
- Hold phone still → stationary indicator on
- Walk with phone → indicator off
- Shake gently → indicator off
- **Target**: Distinguishes 0.02g vs 0.05g motion

### Test 4: Rotation Detection
- Mount phone, rotate slowly (1 rev/10s) → count detents
- Rotate fast (1 rev/2s) → count detents  
- **Target**: 12 detents per 360°, ±1 detent accuracy

### Test 5: Gesture Recognition
- Rotate 2 clicks CW → confirm fires
- Rotate 1 click CCW → cancel fires
- Rotate 1 CW, wait 4s, rotate 1 CW → no gesture (timeout)
- **Target**: 100% recognition, 0 false positives in 5 min idle

### Test 6: Edge Cases
- Phone in case → recalibrate → should work
- Metal desk → mag interference → fallback to gyro-only mode
- Pick up phone mid-rotation → cancel gesture (tilt detection)

## Metrics Display (Debug Overlay)

```tsx
<View style={styles.debugOverlay}>
  <Text>Gyro Z: {omega_z.toFixed(3)} rad/s</Text>
  <Text>Accel RMS: {accelRMS.toFixed(4)} g</Text>
  <Text>Mag: {magDelta.toFixed(1)} µT</Text>
  <Text>Angle: {(angleAccum * 180/Math.PI).toFixed(1)}°</Text>
  <Text>Detents: {detentCount}</Text>
  <Text>Attached: {isAttached ? '✓' : '✗'}</Text>
  <Text>Stationary: {isStationary ? '✓' : '✗'}</Text>
</View>
```

## Success Criteria

**POC is successful if:**
1. Can detect 2 CW rotations → confirm in <2s
2. False positive rate <1 per 10 minutes idle
3. Works reliably with phone in case
4. Haptic feedback feels natural
5. Code is clean enough to upstream to Portal

## Next Steps After POC

1. **Record metrics** during 50+ gesture trials
2. **Tune thresholds** for reliability vs responsiveness  
3. **State machine** for cleaner transitions
4. **Magnetometer mode** (advanced) with off-center magnet
5. **Integration** with Portal SDK payment flow

## Development Tips

- Use Expo Go app for fast iteration (physical device required for sensors)
- Enable debug overlay for all testing
- Log sensor data to file for offline analysis
- Test on multiple surfaces (wood desk, metal, glass)
- Test with and without phone case

