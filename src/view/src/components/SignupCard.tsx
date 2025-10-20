// src/components/SignupCard.tsx
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import TiltedCard from './TiltedCard';
import { isValidEmail, isStrongPassword, calculateAge } from '@/utils/validation';

export default function SignupCard({
  cardW, cardH, onBack, onSubmit,
}: {
  cardW: number;
  cardH: number;
  onBack: () => void;
  onSubmit: (d: { name: string; email: string; password: string; birthdate: string }) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [birthdate, setBirthdate] = useState(''); // YYYY-MM-DD
  const [error, setError] = useState<string | null>(null);

  const inputStyle = { backgroundColor: '#201a14', borderColor: '#3b2d21', borderWidth: StyleSheet.hairlineWidth };

  const submit = () => {
    setError(null);

    if (!name.trim()) return setError('Please enter your name.');
    if (!isValidEmail(email)) return setError('Enter a valid email.');
    if (!isStrongPassword(password)) {
      return setError('Password must be at least 6 characters and include a number and a special character.');
    }
    if (password !== confirm) return setError('Passwords do not match.');
    if (!birthdate) return setError('Please enter your birthdate (YYYY-MM-DD).');

    const age = calculateAge(birthdate);
    if (isNaN(age)) return setError('Please enter a valid birthdate.');
    if (age < 18) return setError('You must be at least 18 years old to create an account.');

    // Hand off to HomeScreen (which calls the API)
    onSubmit({ name, email, password, birthdate });
  };

  // Slightly tighter spacing so the form fits the same card height as login
  const GAP = 8;

  return (
    <TiltedCard width={cardW} height={cardH}>
      <View style={{ gap: GAP }}>
        <Text style={styles.title}>Create your Barter account</Text>
        <Text style={[styles.subtitle, { marginTop: 2 }]}>It’s fast and free.</Text>

        <Text style={[styles.label, { marginTop: 10 }]}>Name</Text>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="Your name"
          placeholderTextColor="#b9a793"
          value={name}
          onChangeText={setName}
        />

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

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="••••••••"
          placeholderTextColor="#b9a793"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        <Text style={styles.label}>Birthdate</Text>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#b9a793"
          keyboardType="numbers-and-punctuation"
          value={birthdate}
          onChangeText={setBirthdate}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={{ gap: 8, flexDirection: 'row' }}>
        <TouchableOpacity onPress={submit} style={[styles.primaryBtn, { flex: 1 }]}>
          <Text style={styles.primaryBtnText}>Create account</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    </TiltedCard>
  );
}

const styles = StyleSheet.create({
  title: { color: '#F5EDE3', fontWeight: '800', fontSize: 22 },
  subtitle: { color: '#D9C9B6' },
  label: { color: '#E7D9C6', marginTop: 10 },
  input: { width: '100%', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10, color: '#F5EDE3' },
  error: { color: '#FF6B6B', marginTop: 4 },
  primaryBtn: { backgroundColor: '#8B5A2B', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#3b2d21', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: '#E7D9C6', fontWeight: '600' },
});
