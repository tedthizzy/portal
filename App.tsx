import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gyroscope, Accelerometer, Magnetometer } from 'expo-sensors';

export default function App() {
  const [gyro, setGyro] = useState({ x: 0, y: 0, z: 0 });
  const [accel, setAccel] = useState({ x: 0, y: 0, z: 0 });
  const [mag, setMag] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    // 100 Hz = 10ms interval
    Gyroscope.setUpdateInterval(10);
    Accelerometer.setUpdateInterval(10);
    Magnetometer.setUpdateInterval(10);

    const gyroSub = Gyroscope.addListener(data => setGyro(data));
    const accelSub = Accelerometer.addListener(data => setAccel(data));
    const magSub = Magnetometer.addListener(data => setMag(data));

    return () => {
      gyroSub.remove();
      accelSub.remove();
      magSub.remove();
    };
  }, []);

  const accelMag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
  const magMag = Math.sqrt(mag.x ** 2 + mag.y ** 2 + mag.z ** 2);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rotation Detection POC</Text>
      <Text style={styles.subtitle}>Phase 1: Sensor Visualization</Text>
      
      <View style={styles.sensorBox}>
        <Text style={styles.sensorTitle}>Gyroscope (rad/s)</Text>
        <Text style={styles.sensorValue}>X: {gyro.x.toFixed(3)}</Text>
        <Text style={styles.sensorValue}>Y: {gyro.y.toFixed(3)}</Text>
        <Text style={styles.sensorValue}>Z: {gyro.z.toFixed(3)} ← rotation</Text>
      </View>

      <View style={styles.sensorBox}>
        <Text style={styles.sensorTitle}>Accelerometer (g)</Text>
        <Text style={styles.sensorValue}>X: {accel.x.toFixed(3)}</Text>
        <Text style={styles.sensorValue}>Y: {accel.y.toFixed(3)}</Text>
        <Text style={styles.sensorValue}>Z: {accel.z.toFixed(3)}</Text>
        <Text style={styles.sensorValue}>|a|: {accelMag.toFixed(3)}</Text>
      </View>

      <View style={styles.sensorBox}>
        <Text style={styles.sensorTitle}>Magnetometer (µT)</Text>
        <Text style={styles.sensorValue}>X: {mag.x.toFixed(1)}</Text>
        <Text style={styles.sensorValue}>Y: {mag.y.toFixed(1)}</Text>
        <Text style={styles.sensorValue}>Z: {mag.z.toFixed(1)}</Text>
        <Text style={styles.sensorValue}>|B|: {magMag.toFixed(1)} ← attachment</Text>
      </View>

      <Text style={styles.instructions}>
        Rotate phone to see gyro.z change{'\n'}
        Place on MagSafe to see |B| increase
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 40,
    paddingTop: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 40,
  },
  sensorBox: {
    backgroundColor: '#111',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  sensorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a84ff',
    marginBottom: 12,
  },
  sensorValue: {
    fontSize: 16,
    fontFamily: 'Courier',
    color: '#fff',
    marginBottom: 4,
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 20,
  },
});
