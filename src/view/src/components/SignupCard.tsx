import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import TiltedCard from './TiltedCard';
import { isValidEmail } from '@/utils/validation';

type SubmitData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  birthdate: string; // "MM/DD/YYYY"
};

export default function SignupCard({
  cardW,
  cardH,
  onSubmit,
  onBack,
}: {
  cardW: number;
  cardH: number;
  onSubmit: (data: SubmitData) => void;
  onBack: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [birthRaw,  setBirthRaw]  = useState('');  // typed string, formatted as MM/DD/YYYY
  const [error,     setError]     = useState<string | null>(null);

  const inputStyle = { backgroundColor: '#201a14', borderColor: '#3b2d21', borderWidth: StyleSheet.hairlineWidth };

  // ---- Birthdate helpers (MM/DD/YYYY) ----
  const formatBirth = (s: string) => {
    // keep digits only, up to 8 (MMDDYYYY)
    const digits = s.replace(/\D/g, '').slice(0, 8);
    const len = digits.length;
    if (len <= 2) return digits; // MM
    if (len <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`; // MM/DD
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`; // MM/DD/YYYY
  };
  const onBirthChange = (val: string) => setBirthRaw(formatBirth(val));

  const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate(); // m: 1..12
  const isValidBirth = (str: string) => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return false;
    const [mm, dd, yyyy] = str.split('/').map(Number);
    if (mm < 1 || mm > 12) return false;
    if (dd < 1 || dd > daysInMonth(yyyy, mm)) return false;

    const dt = new Date(yyyy, mm - 1, dd);
    const today = new Date();
    const min18 = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    if (dt > today) return false;   // no future dates
    return dt <= min18;             // must be at least 18
  };

  // ---- Password helpers ----
  const isStrongPassword = (p: string) => /^(?=.*\d)(?=.*[^a-zA-Z0-9]).{6,}$/.test(p);

  const handleSubmit = () => {
    setError(null);

    if (!firstName.trim()) return setError('Please enter your first name.');
    if (!lastName.trim())  return setError('Please enter your last name.');
    if (!isValidEmail(email)) return setError('Enter a valid email.');

    if (!isStrongPassword(password)) {
      return setError('Password must be ≥ 6 chars and include a number and a special character.');
    }
    if (password !== confirm) return setError('Passwords do not match.');

    if (!isValidBirth(birthRaw)) {
      return setError('Enter a valid birthdate (MM/DD/YYYY). Must be 18 or older.');
    }

    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      birthdate: birthRaw, // stays MM/DD/YYYY; convert to ISO on submit if backend needs it later
    });
  };

  return (
    <TiltedCard width={cardW} height={cardH}>
      <View style={{ gap: 10 }}>
        <Text style={styles.title}>Create your Barter account</Text>
        <Text style={styles.subtitle}>It’s fast and free.</Text>

        {/* First / Last name on one row when there’s room */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>First name</Text>
            <TextInput
              style={[styles.input, inputStyle]}
              placeholder="Jane"
              placeholderTextColor="#b9a793"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Last name</Text>
            <TextInput
              style={[styles.input, inputStyle]}
              placeholder="Doe"
              placeholderTextColor="#b9a793"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>
        </View>

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

        <Text style={styles.label}>Confirm password</Text>
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
          placeholder="MM/DD/YYYY"
          placeholderTextColor="#b9a793"
          keyboardType="numeric"
          value={birthRaw}
          onChangeText={onBirthChange}
          maxLength={10} // MM/DD/YYYY
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={{ gap: 8 }}>
        <TouchableOpacity onPress={handleSubmit} style={styles.primaryBtn}>
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
  title: { color: '#F5EDE3', fontWeight: '800', fontSize: 20 },
  subtitle: { color: '#D9C9B6', marginTop: 2 },
  label: { color: '#E7D9C6', marginTop: 10 },
  input: { width: '100%', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10, color: '#F5EDE3' },
  error: { color: '#FF6B6B', marginTop: 6 },

  primaryBtn: { backgroundColor: '#8B5A2B', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },

  secondaryBtn: { backgroundColor: 'transparent', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', borderColor: '#3b2d21', borderWidth: StyleSheet.hairlineWidth },
  secondaryBtnText: { color: '#E7D9C6', fontWeight: '700' },
});
