
// src/api.ts
const BASE = 'http://localhost:5172';

type Json = Record<string, unknown>;

async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include', // <-- send/receive cookies
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return (await res.json()) as T;
  }
  // @ts-expect-error
  return undefined as T;
}

function post<T = unknown>(path: string, body: Json): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function signinNow(email: string, password: string) {
  // returns { token }
  return post<{ token: string }>('/authentication/sign/in', { email, password });
}

export function signupNow(email: string, password: string) {
  return post<{ token: string }>('/authentication/sign/up', { email, password });
}

// Called on page load to auto-login via session -> returns fresh JWT if session valid
export function checkSession() {
  return request<{ token: string; email: string }>('/authentication/check-session', { method: 'GET' });
}

// Google OAuth: send ID token to backend
export function googleSignin(idToken: string) {
  return post<{ token: string }>('/authentication/google', { idToken });
}

