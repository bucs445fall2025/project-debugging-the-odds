// src/screens/TradingFloor.tsx
import React, { useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AuthUser } from '@/App';
import { createItem, uploadImage } from '@/api';

const BG = '#0f0c0a';
const PANEL = '#15100c';
const BORDER = '#2b2119';
const INK = '#F5EDE3';
const MUTED = '#CDBCA8';
const ACCENT = '#8B5A2B';

type Props = {
  user: AuthUser;        // { email, token }
  onSignOut: () => void;
};

type LocalItem = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  ownerId: string;
  imageKeys: string[];
};

// ---- Decode userId (GUID) from JWT without extra deps ----
function getUserIdFromToken(token?: string): string | null {
  if (!token) return null;
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as Record<string, unknown>;
    // Common placements for user id
    return (
      (payload['nameid'] as string) ||
      (payload['sub'] as string) ||
      (payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] as string) ||
      null
    );
  } catch {
    return null;
  }
}

export default function TradingFloor({ user, onSignOut }: Props) {
  const ownerId = useMemo(() => getUserIdFromToken(user.token), [user.token]);

  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<LocalItem[]>([]);

  // ---- Add Item state ----
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);

  const canCreate = useMemo(
    () => !!ownerId && name.trim().length > 0 && files.length >= 1 && !submitting,
    [ownerId, name, files, submitting]
  );

  const resetForm = () => {
    setName('');
    setDesc('');
    setCat('');
    setFiles([]);
    setFilePreviews([]);
  };

  // ---- Image selection (Web only) ----
  const onPickImages = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => {
      const selected = Array.from(input.files || []);
      setFiles((prev) => [...prev, ...selected]);
      const urls = selected.map((f) => URL.createObjectURL(f));
      setFilePreviews((prev) => [...prev, ...urls]);
    };
    input.click();
  };

  const removePreviewAt = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setFilePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const openAddModal = () => {
    if (!ownerId) {
      alert('Could not determine your user id from the token. Please sign in again.');
      return;
    }
    setAdding(true);
  };

  // ---- Create item flow ----
  const handleCreate = async () => {
    if (!canCreate || !ownerId) return;
    setSubmitting(true);
    try {
      // 1) upload images
      const keys: string[] = [];
      for (const f of files) {
        const res = await uploadImage(f); // -> { Key }
        if (res?.Key) keys.push(res.Key);
      }

      // 2) create item
      const created = await createItem({
        ownerId,
        name: name.trim(),
        description: desc.trim() || undefined,
        category: cat.trim() || undefined,
      });

      const newItem: LocalItem = {
        id: created.id ?? crypto.randomUUID(),
        name: created.name ?? name.trim(),
        description: created.description ?? desc.trim(),
        category: created.category ?? cat.trim(),
        ownerId,
        imageKeys: keys,
      };
      setItems((prev) => [newItem, ...prev]);

      // Done
      resetForm();
      setAdding(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Trading Floor</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={openAddModal}
            style={[styles.accentBtn, !ownerId && { opacity: 0.5 }]}
            disabled={!ownerId}
          >
            <Text style={styles.accentText}>+ Add Item</Text>
          </Pressable>
          <Pressable onPress={onSignOut} style={styles.ghostBtn}>
            <Text style={styles.ghostText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>

      {/* Content: item grid */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.gridWrap}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No items yet. Click “Add Item” to create one.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((it) => (
              <View key={it.id} style={styles.card}>
                <View style={styles.cardImageWrap}>
                  {it.imageKeys?.[0] ? (
                    <Image
                      source={{
                        uri:
                          `${window.location.origin.replace(':5173', ':5172')}/get/image/` +
                          it.imageKeys[0],
                      }}
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.noImage}>
                      <Text style={styles.noImageText}>No Image</Text>
                    </View>
                  )}
                </View>
                <View style={{ padding: 10 }}>
                  <Text style={styles.cardName}>{it.name}</Text>
                  {!!it.description && <Text style={styles.cardDesc}>{it.description}</Text>}
                  {!!it.category && <Text style={styles.cardCat}>#{it.category}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal overlay (always centered, never cut off) */}
      {adding && (
        <View style={styles.overlay}>
          {/* Backdrop */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !submitting && setAdding(false)}
          />
          {/* Centering wrapper */}
          <View style={styles.modalCenter}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Create Item</Text>

              {/* Scrollable body inside fixed-height modal */}
              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: 12, gap: 10 }}
              >
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Item name…"
                  placeholderTextColor={MUTED}
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, { minHeight: 64 }]}
                  placeholder="Optional description…"
                  placeholderTextColor={MUTED}
                  value={desc}
                  onChangeText={setDesc}
                  multiline
                />

                <Text style={styles.label}>Category</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Optional category…"
                  placeholderTextColor={MUTED}
                  value={cat}
                  onChangeText={setCat}
                />

                <Text style={styles.label}>
                  Images <Text style={{ color: '#ffb27a' }}>(min 1)</Text>
                </Text>

                {/* Fixed-height preview tray so buttons never move */}
                <View style={styles.previewTray}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {filePreviews.map((uri, i) => (
                      <View key={i} style={styles.previewItem}>
                        <Image source={{ uri }} style={styles.previewImg} />
                        <Pressable style={styles.previewX} onPress={() => removePreviewAt(i)}>
                          <Text style={styles.previewXText}>×</Text>
                        </Pressable>
                      </View>
                    ))}
                    <Pressable style={styles.addThumb} onPress={onPickImages}>
                      <Text style={styles.addThumbText}>+ Add</Text>
                    </Pressable>
                  </ScrollView>
                </View>
              </ScrollView>

              {/* Sticky footer actions */}
              <View style={styles.actions}>
                <Pressable
                  onPress={() => !submitting && setAdding(false)}
                  style={[styles.ghostBtn, { minWidth: 120, alignItems: 'center' }]}
                  disabled={submitting}
                >
                  <Text style={styles.ghostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreate}
                  style={[
                    styles.accentBtn,
                    { minWidth: 140, alignItems: 'center' },
                    !canCreate && { opacity: 0.5 },
                  ]}
                  disabled={!canCreate}
                >
                  <Text style={styles.accentText}>{submitting ? 'Creating…' : 'Create Item'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomColor: BORDER,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: PANEL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  title: { color: INK, fontWeight: '800', fontSize: 18 },

  accentBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  accentText: { color: '#fff', fontWeight: '700' },

  ghostBtn: {
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1a140f',
  },
  ghostText: { color: INK, fontWeight: '600' },

  scroll: { flex: 1 },
  gridWrap: { padding: 14 },

  empty: {
    padding: 24,
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    backgroundColor: '#14100c',
    alignItems: 'center',
  },
  emptyText: { color: MUTED },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: 240,
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    backgroundColor: '#14100c',
    overflow: 'hidden',
  },
  cardImageWrap: { width: '100%', height: 150, backgroundColor: '#221a14' },
  cardImage: { width: '100%', height: '100%' },
  noImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noImageText: { color: MUTED },
  cardName: { color: INK, fontWeight: '800', fontSize: 16 },
  cardDesc: { color: MUTED, marginTop: 4 },
  cardCat: { color: '#d9a86a', marginTop: 6, fontWeight: '700' },

  // Overlay
  overlay: {
    position: 'fixed' as any, // RN-web will treat absolute/fixed similarly; fixed avoids parent clipping
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 9999,
  },
  modalCenter: {
    // Strong centering that never clips
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: '90%',
    maxWidth: 480,
    maxHeight: '90vh' as any, // allow body to scroll
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    backgroundColor: '#15100c',
    padding: 14,
    gap: 10,
  },
  modalTitle: { color: INK, fontWeight: '900', fontSize: 18, marginBottom: 4 },
  modalBody: { flexGrow: 0 }, // we scroll this explicitly

  label: { color: INK, marginTop: 4 },
  input: {
    color: INK,
    backgroundColor: '#1d1712',
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  previewTray: {
    height: 110,
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    backgroundColor: '#1a1410',
    padding: 8,
    overflow: 'hidden',
  },
  previewItem: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  previewImg: { width: '100%', height: '100%' },
  previewX: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  previewXText: { color: '#fff', fontWeight: '900' },
  addThumb: {
    width: 90, height: 90,
    borderRadius: 10,
    borderColor: ACCENT, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  addThumbText: { color: ACCENT, fontWeight: '800' },

  actions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
