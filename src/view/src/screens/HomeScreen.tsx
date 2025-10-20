// src/screens/HomeScreen.tsx
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import LoginCard from '@/components/LoginCard';
import SignupCard from '@/components/SignupCard';
import { signinNow, signupNow } from '@/api';

export default function HomeScreen() {
  const { width: W0, height: H0 } = Dimensions.get('window');
  const W = W0 || (typeof window !== 'undefined' ? window.innerWidth : 360);
  const H = H0 || (typeof window !== 'undefined' ? window.innerHeight : 640);

  // One shared card size so Login/Signup match exactly
  const cardW = Math.min(380, Math.max(300, Math.round(W * 0.9)));
  const cardH = Math.min(720, Math.max(560, Math.round(H * 0.92)));

  // Track which screen is active (for z-index & pointerEvents)
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  // Vertical slide between Login (0) and Signup (1)
  const slide = useRef(new Animated.Value(0)).current;

  const go = (to: 'login' | 'signup') => {
    setMode(to); // ensure pointerEvents/zIndex reflect intent immediately
    Animated.timing(slide, {
      toValue: to === 'login' ? 0 : 1,
      duration: 800,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  };

  const translateYLogin = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, H * 2],
  });
  const translateYSignup = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-H * 2, 0],
  });
  const opacityLogin = slide.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [1, 0.7, 0.2, 0],
  });
  const opacitySignup = slide.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 0.2, 0.7, 1],
  });

  // ---- API handlers ----
  const handleSignIn = async (email: string, password: string) => {
    try {
      const res = await signinNow(email, password);
      console.log('signed in', res);
    } catch (err) {
      console.error('signin error', err);
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSignUp = async (d: {
    name: string;
    email: string;
    password: string;
    birthdate: string;
  }) => {
    try {
      await signupNow(d.email, d.password);
      go('login');
    } catch (err) {
      console.error('signup error', err);
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={{ flex: 1, height: '100%', position: 'relative' }}>
      {/* Earthy layered background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#7c4c4cff' }]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#4d2600ff', opacity: 0.7 },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          left: -800,
          top: -800,
          width: 1600,
          height: 1600,
          backgroundColor: '#1d1510',
          opacity: 0.65,
          transform: [{ rotate: '35deg' }],
        }}
      />

      {/* Foreground (cards container) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 8,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 480,
            height: H,              // ← numeric height avoids % chain issues
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* LOGIN — on top */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                transform: [{ translateY: translateYLogin }],
                opacity: opacityLogin,
                zIndex: 3,          // ← higher than signup
              },
            ]}
            pointerEvents={mode === 'login' ? 'auto' : 'none'} // ← only interactive when active
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

          {/* SIGNUP — under login */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                transform: [{ translateY: translateYSignup }],
                opacity: opacitySignup,
                zIndex: 2,
              },
            ]}
            pointerEvents={mode === 'signup' ? 'auto' : 'none'} // ← only interactive when active
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
