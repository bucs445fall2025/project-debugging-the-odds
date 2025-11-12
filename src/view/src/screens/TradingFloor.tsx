// src/screens/TradingFloor.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AuthUser } from '@/App';

export default function TradingFloor({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => void;
}) {
  return (
    <View style={styles.root}>
      {/* background */}
      <View style={styles.bgLayer} />

      <View style={styles.header}>
        <Text style={styles.title}>Trading Floor</Text>
        <TouchableOpacity onPress={onSignOut} style={styles.signoutBtn}>
          <Text style={styles.signoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.value}>{user.email}</Text>

          <Text style={[styles.label, { marginTop: 16 }]}>Auth token</Text>
          <Text style={styles.token} numberOfLines={3}>
            {user.token}
          </Text>
        </View>

      
         
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#7e3600ff',
  },
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#7c3a00ff',
    opacity: 0.5,
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 9, 7, 0.15)',
  },
  title: {
    color: '#F5EDE3',
    fontSize: 20,
    fontWeight: '800',
  },
  signoutBtn: {
    backgroundColor: '#8B5A2B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  signoutText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    padding: 18,
    gap: 16,
  },
  card: {
    backgroundColor: '#201a14',
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  label: {
    color: '#CDB8A3',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    color: '#fff',
    fontSize: 16,
    marginTop: 4,
  },
  token: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
});
