// Local dev only: talks to your backend on http://localhost:5172

const RAW_BASE = import.meta.env?.VITE_API_URL ?? 'http://localhost:5172';

// ensure we don't double/miss slashes when joining
function join(base: string, path: string) {
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

type Json = Record<string, unknown>;

async function request<T = unknown>(path: string, init: RequestInit): Promise<T> {
  const url = join(RAW_BASE, path);
  const res = await fetch(url, {
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
  // @ts-expect-error - caller may expect void
  return undefined as T;
}

function get<T = unknown>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

function post<T = unknown>(path: string, body: Json): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

// -----------------------------
// Auth API (matches Program.cs)
// -----------------------------

export function signinNow(email: string, password: string) {
  // POST /authentication/sign/in -> { token }
  return post<{ token: string }>('/authentication/sign/in', { Email: email, Password: password });
}

export function signupNow(email: string, password: string) {
  // POST /authentication/sign/up -> "Account created." or { id?: string }
  return post<{ id?: string } | string>('/authentication/sign/up', { Email: email, Password: password });
}

// -----------------------------
// Items API (matches Program.cs)
// -----------------------------

export function createItem(body: {
  OwnerID: string;       // required by backend
  Name: string;
  Description?: string;
  Category?: string;
  ImageKeys?: string[];  // backend may ignore today; client still enforces ≥1
}) {
  return post('/create/item', body);
}

export function getItemsByOwner(ownerId: string) {
  return get(`/get/items/by/owner/${ownerId}`);
}

// Images (Seaweed/S3 proxy)
export async function uploadImage(file: File): Promise<{ Key: string }> {
  const url = join(RAW_BASE, '/create/image');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(url, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function imageUrl(key: string) {
  return join(RAW_BASE, `/get/image/${key}`);
}
