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

// Google OAuth: send ID token to backend
export async function googleSignin(code: string) {
  const res = await fetch(`${RAW_BASE}/authentication/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Google sign-in failed');
  }

  return res.json() as Promise<{ token: string; email?: string }>;
}

// -----------------------------
// Items API (matches Program.cs)
// -----------------------------

export type ItemCategory =
  | 'Clothing'
  | 'Electronics'
  | 'Furniture'
  | 'Books'
  | 'Labor'
  | 'Tools'
  | 'Experience'
  | 'Other';

type RawImage = { Key?: string; key?: string } | string;

function normalizeGuid(value?: string | null) {
  if (typeof value !== 'string' || value.length === 0) return '';
  return value.replace(/[{}]/g, '').trim().toLowerCase();
}

function ensureGuid(value?: string | null) {
  const guid = normalizeGuid(value);
  if (!guid) throw new Error('Invalid identifier.');
  return guid;
}

function normalizeGuidOrNull(value?: string | null) {
  const guid = normalizeGuid(value);
  return guid.length > 0 ? guid : null;
}

function pickGuidCandidate(raw: RawItem, keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = (raw as Record<string, unknown>)[key];
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return undefined;
}

type RawItem = {
  ID?: string;
  id?: string;
  Name?: string;
  name?: string;
  Description?: string | null;
  description?: string | null;
  Category?: ItemCategory | string;
  category?: ItemCategory | string;
  OwnerID?: string;
  OwnerId?: string;
  ownerId?: string;
  ownerID?: string;
  Images?: RawImage[] | null;
  images?: RawImage[] | null;
  ImageKeys?: string[] | null;
  imageKeys?: string[] | null;
};

export type ItemRecord = {
  id: string;
  name: string;
  description?: string | null;
  category?: ItemCategory | string;
  ownerId: string;
  imageKeys: string[];
};

export type TradeStatus = 'Requested' | 'Accepted' | 'Rejected' | 'Countered';

export type TradeRecord = {
  id: string;
  initiatorId: string;
  receiverId: string;
  status: TradeStatus;
  offeringItems: ItemRecord[];
  seekingItems: ItemRecord[];
};

export function normalizeItem(raw: RawItem): ItemRecord {
  const id = normalizeGuid(
    pickGuidCandidate(raw, ['id', 'ID', 'Id']) ?? raw.id ?? raw.ID ?? ''
  );
  const ownerId = normalizeGuid(
    pickGuidCandidate(raw, ['ownerId', 'OwnerId', 'ownerID', 'OwnerID']) ??
      raw.ownerId ??
      raw.OwnerID ??
      raw.OwnerId ??
      raw.ownerID ??
      ''
  );
  const name = raw.name || raw.Name || '';
  const description = raw.description ?? raw.Description ?? null;
  const category = raw.category ?? raw.Category;
  const imageSources = raw.images ?? raw.Images ?? [];
  let imageKeys =
    imageSources
      ?.map((img) => {
        if (typeof img === 'string') return img;
        return img?.Key || img?.key;
      })
      .filter((key): key is string => typeof key === 'string' && key.length > 0)
      .map((key) => key.trim()) ?? [];

  if (imageKeys.length === 0) {
    const fallback = raw.imageKeys ?? raw.ImageKeys ?? [];
    imageKeys = fallback.filter((key): key is string => typeof key === 'string' && key.length > 0).map((key) => key.trim());
  }

  return { id, ownerId, name, description, category, imageKeys };
}

export async function fetchAllItems(): Promise<ItemRecord[]> {
  const payload = await get<RawItem[]>('/get/items');
  return payload.map(normalizeItem);
}

export async function getItemsByOwner(ownerId: string): Promise<ItemRecord[]> {
  const payload = await get<RawItem[]>(`/get/items/by/owner/${ownerId}`);
  return payload.map(normalizeItem);
}

export async function createItem(payload: {
  ownerId: string;
  name: string;
  description?: string;
  category: ItemCategory;
  imageKeys?: string[];
}): Promise<ItemRecord> {
  const body = {
    OwnerID: payload.ownerId,
    Name: payload.name,
    Description: payload.description,
    Category: payload.category,
    ImageKeys: payload.imageKeys?.filter((key) => Boolean(key)),
  };
  const response = await post<RawItem>('/create/item', body);
  return normalizeItem(response);
}

export function deleteItem(itemId: string, ownerId: string) {
  const path = `/delete/item/${itemId}?ownerId=${ownerId}`;
  return request(path, { method: 'DELETE' });
}

export async function createTrade(payload: {
  initiatorId: string;
  receiverId: string;
  offeringItemIds: string[];
  seekingItemIds: string[];
}) {
  const Initiator = ensureGuid(payload.initiatorId);
  const Receiver = ensureGuid(payload.receiverId);
  const OfferingItems = payload.offeringItemIds.map(ensureGuid);
  const SeekingItems = payload.seekingItemIds.map(ensureGuid);

  return post('/create/trade', {
    Initiator,
    Receiver,
    OfferingItems,
    SeekingItems,
  });
}

function normalizeTrade(raw: any): TradeRecord {
  return {
    id: normalizeGuid(raw.ID || raw.id),
    initiatorId: normalizeGuidOrNull(raw.InitiatorID || raw.initiatorId) ?? '',
    receiverId: normalizeGuidOrNull(raw.ReceiverID || raw.receiverId) ?? '',
    status: (raw.Status || raw.status) as TradeStatus,
    offeringItems: Array.isArray(raw.OfferingItems || raw.offeringItems)
      ? (raw.OfferingItems || raw.offeringItems).map(normalizeItem)
      : [],
    seekingItems: Array.isArray(raw.SeekingItems || raw.seekingItems)
      ? (raw.SeekingItems || raw.seekingItems).map(normalizeItem)
      : [],
  };
}

function isNotFound(error: unknown) {
  return error instanceof Error && error.message.includes('404');
}

function normalizeLegacyTrade(raw: any, itemsById: Map<string, ItemRecord>): TradeRecord {
  const offeringIds: string[] = raw.OfferingItemIDs ?? raw.offeringItemIDs ?? [];
  const seekingIds: string[] = raw.SeekingItemIDs ?? raw.seekingItemIDs ?? [];
  const offeringItems = offeringIds
    .map((id) => itemsById.get(normalizeGuid(id)))
    .filter((item): item is ItemRecord => Boolean(item));
  const seekingItems = seekingIds
    .map((id) => itemsById.get(normalizeGuid(id)))
    .filter((item): item is ItemRecord => Boolean(item));

  return {
    id: normalizeGuid(raw.ID || raw.id),
    initiatorId: normalizeGuidOrNull(raw.InitiatorID || raw.initiatorId) ?? '',
    receiverId: normalizeGuidOrNull(raw.ReceiverID || raw.receiverId) ?? '',
    status: (raw.Status || raw.status) as TradeStatus,
    offeringItems,
    seekingItems,
  };
}

async function fetchPendingTradesLegacy(userId: string): Promise<TradeRecord[]> {
  const trades = await get<any[]>(`/get/trades/by/receiver/${userId}`);
  const relevant = trades.filter((trade) => {
    const status = (trade.Status || trade.status) as TradeStatus;
    return status === 'Requested' || status === 'Countered';
  });
  if (relevant.length === 0) return [];

  const items = await fetchAllItems();
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return relevant.map((trade) => normalizeLegacyTrade(trade, itemsById));
}

export async function fetchPendingTrades(userId: string): Promise<TradeRecord[]> {
  try {
    const payload = await get<any[]>(`/get/trades/pending/${userId}`);
    return payload.map(normalizeTrade);
  } catch (error) {
    if (isNotFound(error)) {
      return fetchPendingTradesLegacy(userId);
    }
    throw error;
  }
}

export async function fetchSentTrades(userId: string): Promise<TradeRecord[]> {
  try {
    const payload = await get<any[]>(`/get/trades/by/initiator/${userId}`);
    if (!Array.isArray(payload) || payload.length === 0) return [];
    const items = await fetchAllItems();
    const itemsById = new Map(items.map((item) => [item.id, item]));
    return payload.map((trade) => normalizeLegacyTrade(trade, itemsById));
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

export function updateTradeStatus(payload: { tradeId: string; receiverId: string; status: TradeStatus }) {
  return request('/update/trade', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ID: ensureGuid(payload.tradeId),
      Receiver: ensureGuid(payload.receiverId),
      Status: payload.status,
    }),
  });
}

// Images (Seaweed/S3 proxy)
type UploadResponse = { Key?: string; key?: string };

export async function uploadImage(file: File): Promise<UploadResponse> {
  const url = join(RAW_BASE, '/create/image');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(url, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function imageUrl(key: string) {
  return join(RAW_BASE, `/get/image/${encodeURIComponent(key)}`);
}

export async function fetchUserProfile(userId: string) {
  const payload = await get<{ ID?: string; id?: string; Name?: string | null; name?: string | null; Email?: string }>(`/get/user/by/id/${userId}`);
  return {
    id: normalizeGuid(payload.ID || payload.id || userId),
    name: payload.Name || payload.name || null,
    email: payload.Email || '',
  };
}
