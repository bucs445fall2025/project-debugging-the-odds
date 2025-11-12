// src/components/CardFanBackground.tsx
import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

type Card = { x: number; y: number; rot: number; scale: number };

// Each skin is the same “look” as your login card:
// - base: the body color of the card
// - overlay: the diagonal top tone (faux gradient)
export type CardSkin = {
  base: string;
  overlay: string;
  border?: string; // optional per-skin border override
};

export default function CardFanBackground({
  count = 18,
  spreadDeg = 110,
  radiusPct = 0.28,
  baseCardW = 180,
  baseCardH = 240,
  radiusJitter = 16,
  angleJitterDeg = 7,
  rotJitterDeg = 10,
  scaleMin = 0.82,
  scaleMax = 0.98,
  borderRadius = 22,

  // NEW: multiple alternating skins (cycled by index)
  skins,

  // Backward-compat (if skins not provided, fall back to the old two-tone)
  colorA = '#4b3621',
  colorB = '#2b2118',
  border = '1px solid rgba(255,255,255,0.06)',
  shadowColor = 'rgba(0,0,0,0.35)',
}: {
  count?: number;
  spreadDeg?: number;
  radiusPct?: number;
  baseCardW?: number;
  baseCardH?: number;
  radiusJitter?: number;
  angleJitterDeg?: number;
  rotJitterDeg?: number;
  scaleMin?: number;
  scaleMax?: number;
  borderRadius?: number;

  skins?: CardSkin[]; // ← pass 2+ to alternate/cycle colors

  colorA?: string; // fallback overlay
  colorB?: string; // fallback base
  border?: string;
  shadowColor?: string;
}) {
  const { width: W, height: H } = Dimensions.get('window');
  const S = Math.max(320, Math.min(W || 360, 1400));
  const R = Math.round(Math.min(W || 360, H || 640) * radiusPct);

  // Final palette: either what you pass in `skins` or the single fallback skin
  const palette: CardSkin[] = useMemo(() => {
    if (skins && skins.length > 0) return skins;
    return [{ base: colorB, overlay: colorA, border }];
  }, [skins, colorA, colorB, border]);

  const cards = useMemo<Card[]>(() => {
    let seed = 42;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    const out: Card[] = [];
    const start = -spreadDeg / 2;
    const step = spreadDeg / Math.max(1, count - 1);

    for (let i = 0; i < count; i++) {
      const baseAng = start + i * step;
      const a = (baseAng + (rand() - 0.5) * angleJitterDeg) * Math.PI / 180;
      const r = R + (rand() - 0.5) * radiusJitter;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.65; // slight vertical squash for nicer fan
      const rot = baseAng * 0.6 + (rand() - 0.5) * rotJitterDeg;
      const sc = scaleMin + (scaleMax - scaleMin) * rand();
      out.push({ x, y, rot, scale: sc });
    }
    return out;
  }, [count, spreadDeg, R, radiusJitter, angleJitterDeg, rotJitterDeg, scaleMin, scaleMax]);

  const cardW = Math.round(baseCardW * (S / 390)); // ~iPhone 12 baseline
  const cardH = Math.round(baseCardH * (S / 390));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 3 }]}>
      {cards.map((c, i) => {
        const skin = palette[i % palette.length]; // ← alternate/cycle skins
        return (
          <View
            key={`bgcard-${i}`}
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              transform: [
                { translateX: -cardW / 2 + c.x * 0.9 },
                { translateY: -cardH / 2 + c.y * 0.9 },
                { rotate: `${c.rot}deg` },
                { scale: c.scale },
              ],
              width: cardW, height: cardH,
              borderRadius,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
              // @ts-ignore (web)
              boxShadow: `0 10px 26px ${shadowColor}`,
              // @ts-ignore (web)
              border: skin.border ?? border,
              backgroundColor: skin.base,
            }}
          >
            {/* Diagonal overlay to mimic the login skin */}
            <View
              // @ts-ignore (web)
              style={{
                position: 'absolute',
                left: -1200, top: -1200, width: 2400, height: 2400,
                transform: [{ rotate: '35deg' }],
                opacity: 0.7,
                backgroundColor: skin.overlay,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}
