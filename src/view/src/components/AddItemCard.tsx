import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, Image as RNImage,
} from 'react-native';

type Props = {
  visible: boolean;
  ownerId: string; // logged-in user id (automatic)
  onClose: () => void;
  onCreate: (payload: {
    ownerId: string;
    name: string;
    description?: string;
    category: 'Clothing' | 'Electronics' | 'Furniture' | 'Books' | 'Labor' | 'Tools' | 'Experience' | 'Other';
    images: File[];
  }) => Promise<void> | void;
};

// Friendly labels -> enum mapping (you can rename labels freely)
const CATEGORY_LABELS = [
  { label: 'Clothing & Apparel', enum: 'Clothing' },
  { label: 'Electronics',        enum: 'Electronics' },
  { label: 'Furniture',          enum: 'Furniture' },
  { label: 'Books & Media',      enum: 'Books' },
  { label: 'Labor / Services',   enum: 'Labor' },
  { label: 'Tools',              enum: 'Tools' },
  { label: 'Experiences',        enum: 'Experience' },
  { label: 'Other',              enum: 'Other' },
] as const;

type EnumType = (typeof CATEGORY_LABELS)[number]['enum'];

export default function AddItemCard({ visible, ownerId, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [catLabel, setCatLabel] = useState<(typeof CATEGORY_LABELS)[number]['label']>('Other');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // translate label -> enum string for the DB
  const categoryEnum: EnumType =
    (CATEGORY_LABELS.find(c => c.label === catLabel)?.enum ?? 'Other') as EnumType;

  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);

  // revoke blob URLs on unmount or when files change
  useEffect(() => {
    return () => previews.forEach(u => URL.revokeObjectURL(u));
  }, [previews]);

  if (!visible) return null;

  const pickImagesWeb = () => {
    if (Platform.OS === 'web' && fileInputRef.current) fileInputRef.current.click();
  };

  const onFilesChangedWeb: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const list = e.target.files;
    if (!list) return;
    const next: File[] = [];
    for (let i = 0; i < list.length; i++) next.push(list.item(i)!);
    setFiles(next);
  };

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError('Please enter a name.');
    if (files.length === 0) return setError('Please add at least one image.');
    try {
      await onCreate({
        ownerId,
        name: name.trim(),
        description: desc.trim() || undefined,
        category: categoryEnum, // exact enum string for DB
        images: files,
      });
      // reset & close
      setName(''); setDesc(''); setCatLabel('Other'); setFiles([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={styles.overlay} /* full-screen centered modal */>
      <View style={styles.card}>
        <Text style={styles.title}>Add New Item</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={[styles.input, styles.inputBg]}
          value={name}
          onChangeText={setName}
          placeholder="e.g., Retro Console"
          placeholderTextColor="#b9a793"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.inputBg, { height: 80 }]}
          value={desc}
          onChangeText={setDesc}
          placeholder="(optional)"
          placeholderTextColor="#b9a793"
          multiline
        />

        <Text style={styles.label}>Category</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.inputBg, styles.selectWrapper]}>
            {/* eslint-disable-next-line react/no-unknown-property */}
            <select
              value={catLabel}
              onChange={(e) => setCatLabel(e.target.value as any)}
              style={styles.select as React.CSSProperties}
            >
              {CATEGORY_LABELS.map((opt) => (
                <option value={opt.label} key={opt.enum}>
                  {opt.label}
                </option>
              ))}
            </select>
          </View>
        ) : (
          <View style={[styles.inputBg, styles.nativeSelectFallback]}>
            <Text style={{ color: '#F5EDE3' }}>{catLabel}</Text>
          </View>
        )}

        <Text style={styles.label}>Images (min 1)</Text>
        {Platform.OS === 'web' && (
          <>
            <TouchableOpacity onPress={pickImagesWeb} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Choose Images…</Text>
            </TouchableOpacity>
            {/* eslint-disable-next-line react/no-unknown-property */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onFilesChangedWeb}
            />
          </>
        )}

        {/* Previews stay INSIDE card */}
        <View style={styles.previewRow}>
          {previews.map((src, i) => (
            <RNImage
              key={i}
              source={{ uri: src }}
              style={styles.preview}
              resizeMode="cover"
              alt="preview"
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.row}>
          <TouchableOpacity onPress={onClose} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={submit} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Create Item</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    inset: 0 as any,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '85vh',
    overflow: 'auto',
    backgroundColor: '#2b2118',
    borderRadius: 20,
    padding: 16,
    borderColor: '#4b3621',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  title: { color: '#F5EDE3', fontWeight: '800', fontSize: 20, marginBottom: 8 },
  label: { color: '#E7D9C6', marginTop: 6 },
  input: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    color: '#F5EDE3',
  },
  inputBg: {
    backgroundColor: '#201a14',
    borderColor: '#3b2d21',
    borderWidth: StyleSheet.hairlineWidth,
  },
  selectWrapper: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  select: {
    width: '100%',
    background: 'transparent',
    color: '#F5EDE3',
    border: 'none',
    outline: 'none',
    padding: '8px 4px',
    fontSize: 14,
    appearance: 'none',
  },
  nativeSelectFallback: { borderRadius: 12, padding: 12 },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  preview: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderColor: '#3b2d21',
    borderWidth: StyleSheet.hairlineWidth,
  },
  error: { color: '#FF6B6B', marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  ghostBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#3a2a1f' },
  ghostBtnText: { color: '#E7D9C6', fontWeight: '600' },
  primaryBtn: { backgroundColor: '#8B5A2B', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});
