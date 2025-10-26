import React, { useState } from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import TiltedCard from './TiltedCard';
import { isValidEmail } from '@/utils/validation';

// If you place a PNG at: src/assets/google.png
import googleLogo from '@/assets/google.png';
// If instead you use /public/google.svg on web, replace the Image's source with: { uri: '/google.svg' }

export default function LoginCard({
  cardW, cardH, onCreate, onSubmit, onForgot,
}: {
  cardW: number;
  cardH: number;
  onCreate: () => void;
  onSubmit: (email: string, password: string) => void;
  onForgot: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const inputStyle = { backgroundColor: '#201a14', borderColor: '#3b2d21', borderWidth: StyleSheet.hairlineWidth };

  const submit = () => {
    setError(null);
    if (!isValidEmail(email)) return setError('Enter a valid email.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    onSubmit(email, password);
  };

  const onGoogle = () => {
    console.log('OAuth Google clicked');
  };

  return (
    <TiltedCard width={cardW} height={cardH}>
      <View style={{ gap: 10 }}>
        <Text style={styles.title}>Barter</Text>
        <Text style={styles.subtitle}>Swap smarter. Trade anything.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="you@example.com"
          placeholderTextColor="#b9a793"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="••••••••"
          placeholderTextColor="#b9a793"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {/* Primary sign in */}
      <View style={{ gap: 10 }}>
        <TouchableOpacity onPress={submit} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        {/* OAuth: Google (logo image) */}
        <TouchableOpacity
          onPress={onGoogle}
          style={styles.oauthBtn}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
        >
          <Image source={googleLogo} style={styles.oauthLogo} resizeMode="contain" />
          <Text style={styles.oauthBtnText}>Sign in with Google</Text>
        </TouchableOpacity>

        {/* Links */}
        <View style={styles.rowSplit}>
          <TouchableOpacity onPress={onCreate}>
            <Text style={styles.link}>Create account</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onForgot}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TiltedCard>
  );
}

const styles = StyleSheet.create({
  title: { color: '#F5EDE3', fontWeight: '800', fontSize: 24 },
  subtitle: { color: '#D9C9B6', marginTop: 4 },
  label: { color: '#E7D9C6', marginTop: 12 },
  input: { width: '100%', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10, color: '#F5EDE3' },
  error: { color: '#FF6B6B', marginTop: 4 },

  primaryBtn: { backgroundColor: '#8B5A2B', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 2 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#3b2d21' },
  dividerText: { color: '#b9a793', paddingHorizontal: 6 },

  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dadce0',
    justifyContent: 'center',
    gap: 8,
  },
  oauthLogo: { width: 18, height: 18 },
  oauthBtnText: { color: '#1a1a1a', fontWeight: '700' },

  rowSplit: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  link: { color: '#E7D9C6', textDecorationLine: 'underline' },
});
