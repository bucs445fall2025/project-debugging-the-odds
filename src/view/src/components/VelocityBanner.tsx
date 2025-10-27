// src/components/VelocityBanner.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function VelocityBanner({
  text,
  height = 36,
  fontSize = 22,
  weight = '800',
  color = '#F5EDE3',
  opacity = 0.22,
  speed = 60,        // pixels per second (>= 0)
  reverse = false,   // true → scroll right; false → scroll left
}: {
  text: string;
  height?: number;
  fontSize?: number;
  weight?: '400' | '600' | '700' | '800';
  color?: string;
  opacity?: number;
  speed?: number;
  reverse?: boolean;
}) {
  const [containerW, setContainerW] = useState(0);
  const [copyW, setCopyW] = useState(0);

  const x = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // Make room for descenders: use a slightly larger lineHeight.
  const lineHeight = Math.round(fontSize * 1.25);
  const effectiveHeight = Math.max(height, lineHeight + 8); // ensure banner tall enough

  const onMeasureContainer = (e: LayoutChangeEvent) => {
    const w = Math.max(0, Math.round(e.nativeEvent.layout.width));
    if (w && w !== containerW) setContainerW(w);
  };

  const onMeasureCopy = useCallback((e: LayoutChangeEvent) => {
    const w = Math.max(0, Math.round(e.nativeEvent.layout.width));
    if (w && w !== copyW) setCopyW(w);
  }, [copyW]);

  const copies = useMemo(() => {
    if (!containerW || !copyW) return 4;
    return Math.max(2, Math.ceil(containerW / copyW) + 2);
  }, [containerW, copyW]);

  const groupW = copies * (copyW || 0);

  const startLoop = useCallback(() => {
    if (!groupW || !speed || speed <= 0) return;

    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }

    const from = reverse ? -groupW : 0;
    const to   = reverse ? 0       : -groupW;

    x.setValue(from);
    const duration = Math.max(100, Math.round((groupW / Math.max(10, speed)) * 1000));

    const runOnce = () =>
      Animated.timing(x, {
        toValue: to,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        x.setValue(from);          // instant wrap
        animRef.current = runOnce();
      });

    animRef.current = runOnce();
  }, [groupW, speed, reverse, x]);

  useEffect(() => {
    if (containerW && copyW && groupW > 0) startLoop();
    return () => {
      if (animRef.current) animRef.current.stop();
      animRef.current = null;
    };
  }, [containerW, copyW, groupW, speed, reverse, startLoop]);

  const Group = ({ measure }: { measure?: boolean }) => (
    <View style={styles.group} pointerEvents="none">
      {Array.from({ length: copies }).map((_, i) => (
        <View
          key={i}
          style={styles.copy}
          onLayout={measure && i === 0 ? onMeasureCopy : undefined}
        >
          <Text
            numberOfLines={1}
            // Ensure no descender clipping
            style={{
              color,
              fontSize,
              lineHeight,
              fontWeight: weight,
              letterSpacing: -0.3,
              textTransform: 'uppercase',
            }}
          >
            {text}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View
      style={[styles.wrap, { height: effectiveHeight, opacity }]}
      onLayout={onMeasureContainer}
      pointerEvents="none"
    >
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', transform: [{ translateX: x }] }}>
        <Group measure />
        <Group />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',     // we keep horizontal clipping, but add vertical padding via copy
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  copy: {
    paddingRight: 32,
    paddingVertical: 4,     // extra breathing room top/bottom
  },
});
