// src/App.tsx
import React, { useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import TradingFloor from './screens/TradingFloor';

export type AuthUser = {
  email: string;
  token: string;
};

export default function App() {
  // null = not logged in
  const [user, setUser] = useState<AuthUser | null>(null);

  if (!user) {
    return (
      <HomeScreen
        onAuthenticated={(u) => {
          // u = { email, token }
          setUser(u);
        }}
      />
    );
  }

  return (
    <TradingFloor
      user={user}
      onSignOut={() => setUser(null)}
    />
  );
}
