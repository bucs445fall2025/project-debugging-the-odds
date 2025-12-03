import React, { useCallback, useRef } from 'react';
import { Animated, GestureResponderEvent, StyleSheet, View } from 'react-native';

export default function TiltedCard({
  children, width, height,
}: { children: React.ReactNode; width: number; height: number }) {
  const rx = useRef(new Animated.Value(0)).current;
  const ry = useRef(new Animated.Value(0)).current;
  const amp = 4;

  const reset = useCallback(() => {
    Animated.parallel([
      Animated.spring(rx, { toValue: 0, useNativeDriver: true }),
      Animated.spring(ry, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [rx, ry]);

  const onMove = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const nx = (locationX / width) * 2 - 1;
    const ny = (locationY / height) * 2 - 1;
    rx.setValue(-ny * amp);
    ry.setValue(nx * amp);
  };

  return (
    <Animated.View
      onStartShouldSetResponder={() => true}
      onResponderMove={onMove}
      onResponderRelease={reset}
      onResponderTerminate={reset}
      style={[
        styles.card,
        {
          width, height,
          transform: [
            { perspective: 1000 },
            { rotateX: rx.interpolate({ inputRange: [-25, 25], outputRange: ['-25deg', '25deg'], extrapolate: 'clamp' }) },
            { rotateY: ry.interpolate({ inputRange: [-25, 25], outputRange: ['-25deg', '25deg'], extrapolate: 'clamp' }) },
            { scale: 1 },
          ],
        },
      ]}
    >
      {/* Faux gradient skin */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2b2118', borderRadius: 22 }]} />
        <View style={{ position: 'absolute', left: -1200, top: -1200, width: 2400, height: 2400, backgroundColor: '#4b3621', opacity: 0.7, transform: [{ rotate: '35deg' }], borderRadius: 22 }} />
      </View>

      <View style={styles.inner}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  inner: { flex: 1, padding: 16, justifyContent: 'space-between' },
});
