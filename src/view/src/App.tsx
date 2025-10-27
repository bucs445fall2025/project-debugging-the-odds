import React from 'react';
import { View, Text } from 'react-native';
import HomeScreen from '@/screens/HomeScreen';

export default function App() {
  return (
    <View style={{ flex: 1, height: '100%' }}>
      {/* If you don't see this text, the problem is outside RN (index.html/CSS) */}
      <Text style={{ color: 'white', position: 'absolute', top: 8, left: 8, zIndex: 9999 }}>
        App mounted
      </Text>
      <HomeScreen />
    </View>
  );
}
