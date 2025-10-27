// src/screens/HomeScreen.tsx
import React, { useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing,
  KeyboardAvoidingView, Platform, StyleSheet, View,
} from 'react-native';

import LoginCard from '@/components/LoginCard';
import SignupCard from '@/components/SignupCard';
import VelocityBanner from '@/components/VelocityBanner';
import { signinNow, signupNow } from '@/api';
import SoftBlindsBackground from '@/components/SoftBlindsBackground';
import CardFanBackground from '@/components/CardFanBackground';

export default function HomeScreen() {
  const { width: W0, height: H0 } = Dimensions.get('window');
  const W = W0 || (typeof window !== 'undefined' ? window.innerWidth : 360);
  const H = H0 || (typeof window !== 'undefined' ? window.innerHeight : 640);

  const cardW = Math.min(380, Math.max(300, Math.round(W * 0.9)));
  const cardH = Math.min(720, Math.max(560, Math.round(H * 0.92)));

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const slide = useRef(new Animated.Value(0)).current;

  const go = (to: 'login' | 'signup') => {
    setMode(to);
    Animated.timing(slide, {
      toValue: to === 'login' ? 0 : 1,
      duration: 800,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  };

  const translateYLogin = slide.interpolate({ inputRange: [0, 1], outputRange: [0, H * 2] });
  const translateYSignup = slide.interpolate({ inputRange: [0, 1], outputRange: [-H * 2, 0] });
  const opacityLogin = slide.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [1, 0.7, 0.2, 0] });
  const opacitySignup = slide.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.2, 0.7, 1] });

  const handleSignIn = async (email: string, password: string) => {
    try { const res = await signinNow(email, password); console.log('signed in', res); }
    catch (err) { console.error('signin error', err); alert(err instanceof Error ? err.message : String(err)); }
  };
  const handleSignUp = async (d: { firstName: string; lastName: string; email: string; password: string; birthdate: string; }) => {
    try { await signupNow(d.email, d.password); go('login'); }
    catch (err) { console.error('signup error', err); alert(err instanceof Error ? err.message : String(err)); }
  };

  return (
    <View style={{ flex: 1, height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Subtle moving gradient base */}
          {/* NEW: Fan of cards directly behind auth card */}
           <View style={[StyleSheet.absoluteFill, { backgroundColor: '#7c4c4cff' }]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#613200ff', opacity: 0.7 },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          left: -800,
          top: -800,
          width: 1200,
          height: 2000,
          backgroundColor: '#1d1510',
          opacity: 0.65,
          transform: [{ rotate: '35deg' }],
        }}
      />
     <CardFanBackground
        count={15}
        spreadDeg={680}
        radiusPct={0.05}
        radiusJitter= {16}
        angleJitterDeg = {15}
        baseCardW={120}
        baseCardH={240}
        scaleMin = {0.6}
        scaleMax = {0.9}
        borderRadius={40}
        skins={[
          { base: '#2b2118', overlay: '#4b3621' }, // deep brown
          { base: '#33261d', overlay: '#6b4a2f' }, // mahogany
          { base: '#3a2a1f', overlay: '#8B5A2B' }, // saddle brown
          { base: '#281e16', overlay: '#5a4028' }, // dark roast
        ]}
/>
      {/* Center banner UNDER the cards */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 3, justifyContent: 'center' }]}>
        <VelocityBanner text=" Swap Smarter • Swap Smarter •" height={50} fontSize={45} speed={60} opacity={0.50} reverse />
        <VelocityBanner text=" Trade Anything • Trade Anything •" height={50} fontSize={45} speed={60} opacity={0.50} />
      </View>

 
      {/* Foreground: auth cards */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8, position: 'relative', zIndex: 5 }}
      >
        <View style={{ width: '100%', maxWidth: 480, height: H, overflow: 'hidden', position: 'relative' }}>
          {/* LOGIN */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateY: translateYLogin }], opacity: opacityLogin, zIndex: 3 }]}
            pointerEvents={mode === 'login' ? 'auto' : 'none'}
          >
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <LoginCard
                cardW={cardW}
                cardH={cardH}
                onCreate={() => go('signup')}
                onSubmit={handleSignIn}
                onForgot={() => console.log('Forgot password')}
              />
            </View>
          </Animated.View>

          {/* SIGNUP */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateY: translateYSignup }], opacity: opacitySignup, zIndex: 2 }]}
            pointerEvents={mode === 'signup' ? 'auto' : 'none'}
          >
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <SignupCard
                cardW={cardW}
                cardH={cardH}
                onBack={() => go('login')}
                onSubmit={handleSignUp}
              />
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
