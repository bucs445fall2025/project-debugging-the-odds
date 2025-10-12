// src/api.ts
// Local dev only: talks to your backend on http://localhost:5172

const BASE = 'http://localhost:5172';

type Json = Record<string, unknown>;

async function request<T = unknown>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
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
  // Allow non-JSON responses (e.g., plain success strings)
  // @ts-expect-error
  return undefined as T;
}

function post<T = unknown>(path: string, body: Json): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

// -----------------------------
// Auth API (matches Program.cs /api/auth/* aliases)
// -----------------------------

export function signinNow(email: string, password: string) {
  // POST /api/auth/signin -> { token }
  return post<{ token: string }>('/api/auth/signin', { email, password });
}

export function signupNow(email: string, password: string) {
  // POST /api/auth/signup -> "Account created." or { id?: string }
  return post<{ id?: string } | string>('/api/auth/signup', { email, password });
}
