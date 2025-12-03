// src/App.tsx
import React, { useEffect, useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import TradingFloor from './screens/TradingFloor';
import PendingOffers from './screens/PendingOffers';
import { fetchPendingTrades, fetchSentTrades } from './api';

export type AuthUser = {
  email: string;
  token: string;
};

export default function App() {
  // null = not logged in
  const [user, setUser] = useState<AuthUser | null>(() => {
  if (typeof window === 'undefined') return null;

  const token = window.localStorage.getItem('auth_token');
  const email = window.localStorage.getItem('auth_email');

  if (token && email) {
    return { email, token };
  }
  return null;
});
  const [screen, setScreen] = useState<'floor' | 'pending'>('floor');
  const [pendingAlert, setPendingAlert] = useState(false);

  useEffect(() => {
    if (!user) return;
    const id = getCleanGuid(user.token);
    if (!id) return;
    let cancelled = false;
    const loadAlerts = async () => {
      try {
        const [incoming, sent] = await Promise.all([
          fetchPendingTrades(id),
          fetchSentTrades(id),
        ]);
        if (!cancelled) {
          let dismissed: string[] = [];
          if (typeof window !== 'undefined') {
            try {
              dismissed = JSON.parse(window.localStorage.getItem('dismissedSentTrades') ?? '[]');
            } catch {
              dismissed = [];
            }
          }
          const hasAlerts =
            incoming.length > 0 ||
            sent.some((trade) => trade.status !== 'Requested' && !dismissed.includes(trade.id));
          setPendingAlert(hasAlerts);
        }
      } catch {
        if (!cancelled) setPendingAlert(false);
      }
    };
    loadAlerts();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
	  return (
	    <HomeScreen
	      onAuthenticated={(u) => {
		// u = { email, token }
		setUser(u);
		if (typeof window !== 'undefined') {
		  window.localStorage.setItem('auth_token', u.token);
		  window.localStorage.setItem('auth_email', u.email);
		}
	      }}
	    />
	  );
	}
 
  if (screen === 'pending') {
    return (
      <PendingOffers
        user={user}
        onBack={() => setScreen('floor')}
	onSignOut={() => {
	  setUser(null);
	  setScreen('floor');
	  setPendingAlert(false);
	  if (typeof window !== 'undefined') {
	    window.localStorage.removeItem('auth_token');
	    window.localStorage.removeItem('auth_email');
	  }
	}}
        onNotificationChange={setPendingAlert}
      />
    );
  }

  return (
    <TradingFloor
      user={user}
      onShowPending={() => setScreen('pending')}
      onSignOut={() => {
	  setUser(null);
	  setScreen('floor');
	  setPendingAlert(false);
	  if (typeof window !== 'undefined') {
	    window.localStorage.removeItem('auth_token');
	    window.localStorage.removeItem('auth_email');
	  }
	}}
      pendingAlert={pendingAlert}
    />
  );
}

function getCleanGuid(token?: string) {
  if (!token) return null;
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as Record<string, unknown>;
    const value =
      (payload['user_id'] as string) ||
      (payload['nameid'] as string) ||
      (payload['sub'] as string) ||
      (payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] as string) ||
      null;
    return value ? value.replace(/[{}]/g, '').trim().toLowerCase() : null;
  } catch {
    return null;
  }
}
