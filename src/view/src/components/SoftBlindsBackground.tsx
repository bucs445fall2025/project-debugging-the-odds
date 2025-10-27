// src/components/SoftBlindsBackground.tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

export default function SoftBlindsBackground({
  colors = ['#2b2118', '#4b3621', '#8B5A2B', '#3b2d21', '#1a120b'],
  baseAngle = 28,

  // Primary blinds
  blindAngle = 70,                // non-orthogonal
  stripeWidth = 14,
  stripeGap = 10,
  speed = 18,                     // px/sec

  // Overlap (second) blinds — soft, no dark band → no grid
  overlap = true,
  overlapAngle = 70,              // another non-orthogonal angle
  overlapSpeedFactor = -0.35,     // relative speed (negative = opposite)
  overlapWidthFactor = 0.6,
  overlapGapFactor = 1.3,
  primaryBrightAlpha = 0.08,
  primaryDarkAlpha = 0.10,
  overlapBrightAlpha = 0.06,

  // Spotlight
  spotlight = true,
  spotlightRadius = 0.65,
  spotlightOpacity = 0.28,
  mouseEase = 0.12,
}: {
  colors?: string[];
  baseAngle?: number;

  blindAngle?: number;
  stripeWidth?: number;
  stripeGap?: number;
  speed?: number;

  overlap?: boolean;
  overlapAngle?: number;
  overlapSpeedFactor?: number;
  overlapWidthFactor?: number;
  overlapGapFactor?: number;
  primaryBrightAlpha?: number;
  primaryDarkAlpha?: number;
  overlapBrightAlpha?: number;

  spotlight?: boolean;
  spotlightRadius?: number;
  spotlightOpacity?: number;
  mouseEase?: number;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<number>(0);

  // Per-layer 2D offsets (we scroll along each gradient’s axis)
  const posA = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const posB = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Spotlight tracking
  const targetRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 }); // %
  const curRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });

  const rafRef = useRef<number | null>(null);

  const baseGradient = `linear-gradient(${baseAngle}deg, ${colors.join(', ')})`;

  const buildBlinds = (angle: number, bright: number, dark: number, w: number, g: number) => `
    repeating-linear-gradient(${angle}deg,
      rgba(255,255,255,${bright}) 0px,
      rgba(255,255,255,${bright}) ${w}px,
      rgba(0,0,0,${dark}) ${w}px,
      rgba(0,0,0,${dark}) ${w + g}px
    )`;

  const blindsA = buildBlinds(blindAngle, primaryBrightAlpha, primaryDarkAlpha, stripeWidth, stripeGap);

  // Overlap: bright-only (dark fully transparent) to avoid grid intersections
  const oW = Math.max(2, Math.round(stripeWidth * overlapWidthFactor));
  const oG = Math.max(2, Math.round(stripeGap * overlapGapFactor));
  const blindsB = overlap
    ? `
      repeating-linear-gradient(${overlapAngle}deg,
        rgba(255,255,255,${overlapBrightAlpha}) 0px,
        rgba(255,255,255,${overlapBrightAlpha}) ${oW}px,
        rgba(0,0,0,0) ${oW}px,
        rgba(0,0,0,0) ${oW + oG}px
      )`
    : null;

  const spot = spotlight
    ? `radial-gradient(circle at var(--mx,50%) var(--my,50%),
        rgba(255,255,255,${spotlightOpacity}) 0%,
        rgba(255,255,255,0.0) ${Math.round(spotlightRadius * 100)}%)`
    : 'linear-gradient(0deg, rgba(0,0,0,0), rgba(0,0,0,0))';

  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;

    // Compose layered images
    const images = [
      blindsA,                 // primary blinds
      ...(blindsB ? [blindsB] : []),
      spot,                    // spotlight
      baseGradient,            // base
    ].join(', ');

    // Blend: second layer softer to avoid harsh intersections
    const blends = [
      'overlay',               // primary
      ...(blindsB ? ['soft-light'] : []),
      'screen',                // spotlight
      'normal',                // base
    ].join(', ');

    el.style.backgroundImage = images;
    el.style.backgroundBlendMode = blends;
    el.style.backgroundRepeat = [
      'repeat',
      ...(blindsB ? ['repeat'] : []),
      'no-repeat',
      'no-repeat',
    ].join(', ');
    el.style.backgroundSize = [
      'auto',
      ...(blindsB ? ['auto'] : []),
      '100% 100%',
      '100% 100%',
    ].join(', ');
    el.style.backgroundPosition = [
      '0px 0px',
      ...(blindsB ? ['0px 0px'] : []),
      '0% 0%',
      '0% 0%',
    ].join(', ');
    el.style.willChange = 'background-position';

    // Pointer → spotlight target
    const onMove = (e: PointerEvent) => {
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      targetRef.current.x = Math.max(0, Math.min(100, (e.clientX / vw) * 100));
      targetRef.current.y = Math.max(0, Math.min(100, (e.clientY / vh) * 100));
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    // Precompute unit vectors along each gradient’s axis
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const aRad = toRad(blindAngle);
    const bRad = toRad(overlapAngle);

    // Move *along the gradient axis* → no shearing/trapezoid illusion
    const dirA = { x: Math.cos(aRad), y: Math.sin(aRad) };
    const dirB = { x: Math.cos(bRad), y: Math.sin(bRad) };

    const tick = (t: number) => {
      const last = lastRef.current || t;
      const dt = Math.max(0, Math.min(0.05, (t - last) / 1000));
      lastRef.current = t;

      // Advance along each layer's axis
      posA.current.x += dirA.x * speed * dt;
      posA.current.y += dirA.y * speed * dt;

      if (blindsB) {
        const s = speed * (overlapSpeedFactor || -0.35);
        posB.current.x += dirB.x * s * dt;
        posB.current.y += dirB.y * s * dt;
      }

      // Ease spotlight to mouse
      const cur = curRef.current;
      const trg = targetRef.current;
      cur.x += (trg.x - cur.x) * mouseEase;
      cur.y += (trg.y - cur.y) * mouseEase;
      el.style.setProperty('--mx', `${cur.x}%`);
      el.style.setProperty('--my', `${cur.y}%`);

      // Apply per-layer positions
      const positions = [
        `${posA.current.x}px ${posA.current.y}px`,                            // primary
        ...(blindsB ? [`${posB.current.x}px ${posB.current.y}px`] : []),      // overlap
        '0% 0%',                                                              // spotlight
        '0% 0%',                                                              // base
      ].join(', ');
      el.style.backgroundPosition = positions;

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    baseGradient,
    blindsA,
    blindsB,
    spot,
    speed,
    blindAngle,
    overlapAngle,
    overlapSpeedFactor,
    mouseEase,
  ]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
      <div ref={layerRef} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}
