// src/screens/TradingFloor.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AuthUser } from '@/App';
import AddItemCard from '@/components/AddItemCard';
import {
  createItem,
  createTrade,
  deleteItem as deleteItemApi,
  fetchAllItems,
  fetchUserProfile,
  imageUrl,
  uploadImage,
  type ItemRecord,
} from '@/api';

const BG = '#080604';
const PANEL = '#140d08';
const BORDER = '#2d1c11';
const INK = '#F5EDE3';
const MUTED = '#CDBCA8';
const ACCENT = '#B8743A';

type Props = {
  user: AuthUser;
  onSignOut: () => void;
  onShowPending: () => void;
  pendingAlert: boolean;
};

function getUserIdFromToken(token?: string): string | null {
  if (!token) return null;
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as Record<string, unknown>;
    return (
      (payload['user_id'] as string) ||
      (payload['nameid'] as string) ||
      (payload['sub'] as string) ||
      (payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] as string) ||
      null
    );
  } catch {
    return null;
  }
}

function cleanGuid(id?: string | null) {
  if (!id) return null;
  const trimmed = id.replace(/[{}]/g, '').trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function shortId(id?: string | null) {
  if (!id) return 'unknown';
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

type CardContext = 'market' | 'inventory';

function ItemCard({
  item,
  selected,
  context,
  onPress,
  onDelete,
  deleting,
  ownerLabel,
}: {
  item: ItemRecord;
  selected: boolean;
  context: CardContext;
  onPress: () => void;
  onDelete?: (item: ItemRecord) => void;
  deleting?: boolean;
  ownerLabel: string;
}) {
  const firstImage = item.imageKeys[0];

  return (
    <Pressable onPress={onPress} style={styles.cardWrapper}>
      <View style={[styles.cardShell, selected && styles.cardShellSelected]}>
        <View style={styles.cardImageWrap}>
          {firstImage ? (
            <Image
              source={{ uri: imageUrl(firstImage) }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImage}>
              <Text style={styles.noImageText}>No photo</Text>
            </View>
          )}
          {context === 'inventory' ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                if (!deleting) onDelete?.(item);
              }}
              style={styles.deleteBadge}
            >
              <Text style={styles.deleteBadgeText}>{deleting ? '...' : '✕'}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.category ? (
              <Text style={styles.cardTag}>{String(item.category)}</Text>
            ) : null}
          </View>
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.description || (context === 'market' ? 'Tap to add to your ask.' : 'Tap to include in your offer.')}
          </Text>
          <Text style={styles.cardOwner}>{ownerLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function MatRow({
  title,
  items,
}: {
  title: string;
  items: ItemRecord[];
}) {
  return (
    <View style={styles.matRow}>
      <Text style={styles.matRowTitle}>{title}</Text>
      {items.length === 0 ? (
        <View style={styles.matEmpty}>
          <Text style={styles.matEmptyText}>No cards placed.</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.matCards}
        >
          {items.map((card) => {
            const firstImage = card.imageKeys[0];
            return (
              <View key={card.id} style={styles.matCard}>
                {firstImage ? (
                  <Image source={{ uri: imageUrl(firstImage) }} style={styles.matCardImage} resizeMode="cover" />
                ) : (
                  <View style={styles.matCardPlaceholder}>
                    <Text style={styles.matCardPlaceholderText}>No photo</Text>
                  </View>
                )}
                <Text style={styles.matCardName} numberOfLines={1}>
                  {card.name}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export default function TradingFloor({ user, onSignOut, onShowPending, pendingAlert }: Props) {
  const ownerId = useMemo(() => cleanGuid(getUserIdFromToken(user.token)), [user.token]);

  const [inventory, setInventory] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [selectedMine, setSelectedMine] = useState<string[]>([]);
  const [selectedOthers, setSelectedOthers] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, { name: string | null; email: string }>>({});
  const fetchingProfiles = useRef<Set<string>>(new Set());

  const itemsById = useMemo(() => {
    const map = new Map<string, ItemRecord>();
    inventory.forEach((item) => map.set(item.id, item));
    return map;
  }, [inventory]);

  const myItems = useMemo(
    () => (ownerId ? inventory.filter((item) => item.ownerId === ownerId) : []),
    [inventory, ownerId],
  );
  const marketItems = useMemo(
    () => (ownerId ? inventory.filter((item) => item.ownerId !== ownerId) : inventory),
    [inventory, ownerId],
  );

  const selectedReceiverId = useMemo(() => {
    if (selectedOthers.length === 0) return null;
    const owners = new Set(
      selectedOthers
        .map((id) => itemsById.get(id)?.ownerId)
        .filter((id): id is string => Boolean(id)),
    );
    return owners.size === 1 ? owners.values().next().value ?? null : null;
  }, [itemsById, selectedOthers]);

  const offerReady = Boolean(
    ownerId &&
    selectedReceiverId &&
    selectedMine.length > 0 &&
    selectedOthers.length > 0,
  );

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchAllItems();
      setInventory(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Could not load items: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    const ids = new Set(inventory.map((item) => item.ownerId).filter(Boolean));
    ids.forEach((rawId) => {
      const id = cleanGuid(rawId);
      if (!id) return;
      if (userProfiles[id] || fetchingProfiles.current.has(id)) return;
      fetchingProfiles.current.add(id);
      fetchUserProfile(id)
        .then((profile) => {
          setUserProfiles((prev) => ({ ...prev, [id]: profile }));
        })
        .catch(() => {})
        .finally(() => {
          fetchingProfiles.current.delete(id);
        });
    });
  }, [inventory, userProfiles]);

  const getDisplayName = useCallback((userId?: string | null) => {
    const id = cleanGuid(userId);
    if (!id) return 'Unknown trader';
    const profile = userProfiles[id];
    if (profile?.name) {
      const parts = profile.name.trim().split(/\s+/);
      const first = parts[0];
      const lastInitial = parts[1]?.[0];
      if (first && lastInitial) return `${first} ${lastInitial}.`;
      if (first) return first;
    }
    if (profile?.email) {
      return profile.email.split('@')[0] || `Trader ${shortId(id)}`;
    }
    return `Trader ${shortId(id)}`;
  }, [userProfiles]);

  const toggleMine = useCallback((item: ItemRecord) => {
    setSelectedMine((prev) =>
      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
    );
  }, []);

  const toggleMarket = useCallback((item: ItemRecord) => {
    setSelectedOthers((prev) => {
      if (prev.includes(item.id)) {
        return prev.filter((id) => id !== item.id);
      }
      const previousOwner = prev.length > 0 ? itemsById.get(prev[0])?.ownerId : null;
      if (previousOwner && previousOwner !== item.ownerId) {
        setBanner('You can only barter with one trader at a time.');
        return prev;
      }
      return [...prev, item.id];
    });
  }, [itemsById]);

  const clearSelections = useCallback(() => {
    setSelectedMine([]);
    setSelectedOthers([]);
  }, []);

  const sendOffer = useCallback(async () => {
    if (!offerReady || !ownerId || !selectedReceiverId) return;
    setSendingOffer(true);
    setError(null);
    try {
      await createTrade({
        initiatorId: ownerId,
        receiverId: selectedReceiverId,
        offeringItemIds: selectedMine,
        seekingItemIds: selectedOthers,
      });
      setBanner('Offer sent! We will nudge the other trader to respond.');
      clearSelections();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Unable to send offer: ${message}`);
    } finally {
      setSendingOffer(false);
    }
  }, [clearSelections, offerReady, ownerId, selectedMine, selectedOthers, selectedReceiverId]);

  const openAddModal = () => {
    if (!ownerId) {
      setError('Could not read your session. Please sign in again.');
      return;
    }
    setShowAdd(true);
  };

  const handleDeleteItem = useCallback(async (item: ItemRecord) => {
    if (!ownerId) return;
    const allow = Platform.OS === 'web'
      ? (typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('Remove this listing permanently?')
        : true)
      : true;
    if (!allow) return;

    setDeletingId(item.id);
    try {
      await deleteItemApi(item.id, ownerId);
      setInventory((prev) => prev.filter((entry) => entry.id !== item.id));
      setSelectedMine((prev) => prev.filter((id) => id !== item.id));
      setBanner('Listing deleted.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Unable to delete item: ${message}`);
    } finally {
      setDeletingId(null);
    }
  }, [ownerId]);

  const handleCreateItem = useCallback(async ({
    ownerId: payloadOwner,
    name,
    description,
    category,
    images,
  }: Parameters<React.ComponentProps<typeof AddItemCard>['onCreate']>[0]) => {
    const authorIdRaw = ownerId ?? payloadOwner;
    if (!authorIdRaw) throw new Error('Missing user id.');
    const authorId = cleanGuid(authorIdRaw) as string;

    const uploadedKeys: string[] = [];
    for (const file of images) {
      const res = await uploadImage(file);
      const key = (res.Key ?? (res as { key?: string }).key)?.trim();
      if (key) uploadedKeys.push(key);
    }

    const created = await createItem({
      ownerId: authorId,
      name,
      description,
      category,
      imageKeys: uploadedKeys,
    });

    const hydrated = {
      ...created,
      ownerId: authorId,
      imageKeys: created.imageKeys.length > 0 ? created.imageKeys : uploadedKeys,
    };

    setInventory((prev) => {
      const next = prev.filter((item) => item.id !== hydrated.id);
      return [...next, hydrated];
    });

    await loadInventory();
    setBanner('Item listed on the floor.');
  }, [loadInventory, ownerId]);

  const renderRail = (
    title: string,
    hint: string,
    items: ItemRecord[],
    context: CardContext,
    toggle: (item: ItemRecord) => void,
  ) => {
    const emptyCopy =
      context === 'market'
        ? 'No community listings yet. Encourage your friends to post something!'
        : 'List an item to build your pack.';

    return (
      <View style={[styles.rail, context === 'inventory' && styles.inventoryRail]}>
        <View style={styles.railHeader}>
          <View>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionHint}>{hint}</Text>
          </View>
          <View style={styles.railCounters}>
            <Text style={styles.counterText}>
              {context === 'market' ? selectedOthers.length : selectedMine.length} selected
            </Text>
            <Text style={styles.counterText}>
              {items.length} {items.length === 1 ? 'card' : 'cards'}
            </Text>
          </View>
        </View>

        {loading ? (
          <Text style={styles.mutedText}>Loading cards...</Text>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.mutedText}>{emptyCopy}</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.railScroll}
          >
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                selected={
                  context === 'market'
                    ? selectedOthers.includes(item.id)
                    : selectedMine.includes(item.id)
                }
                context={context}
                onPress={() => toggle(item)}
                onDelete={context === 'inventory' ? handleDeleteItem : undefined}
                deleting={deletingId === item.id}
                ownerLabel={context === 'inventory' ? 'From your pack' : getDisplayName(item.ownerId)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>Signed in as {user.email}</Text>
            <Text style={styles.headerTitle}>Trading Floor</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.actionBtn} onPress={loadInventory}>
              <Text style={styles.actionText}>Refresh</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, pendingAlert && styles.alertBtn]}
              onPress={onShowPending}
            >
              <Text style={styles.actionText}>Pending Offers</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.accentBtn]} onPress={openAddModal}>
              <Text style={styles.actionText}>List Item</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={onSignOut}>
              <Text style={styles.actionText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>

        {error ? (
          <View style={[styles.banner, styles.errorBanner]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {banner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        ) : null}

        <View style={styles.board}>
          {renderRail(
            'Marketplace rail',
            'Tap cards from other traders to build your ask.',
            marketItems,
            'market',
          toggleMarket,
        )}

        <View style={styles.duelMat}>
            <MatRow
              title={
                selectedReceiverId
                  ? `Requesting from ${getDisplayName(selectedReceiverId)}`
                  : 'Requesting from another trader'
              }
              items={selectedOthers
                .map((id) => itemsById.get(id))
                .filter((item): item is ItemRecord => Boolean(item))}
            />
          <MatRow
            title="Offering from your pack"
            items={selectedMine
              .map((id) => itemsById.get(id))
              .filter((item): item is ItemRecord => Boolean(item))}
          />

          {offerReady ? (
            <View style={styles.offerRow}>
              <Pressable style={styles.resetLink} onPress={clearSelections}>
                <Text style={styles.resetLinkText}>Reset selection</Text>
              </Pressable>
              <Pressable
                style={[styles.flashyButton, sendingOffer && styles.disabledBtn]}
                onPress={sendOffer}
                disabled={sendingOffer}
              >
              <Text style={styles.flashyButtonText}>
                  {sendingOffer ? 'Sending...' : `Send offer to ${getDisplayName(selectedReceiverId)}`}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

          {renderRail(
            'Your pack',
            'Choose which of your items make up your counter offer.',
            myItems,
            'inventory',
            toggleMine,
          )}
        </View>
      </ScrollView>

      {ownerId ? (
        <AddItemCard
          visible={showAdd}
          ownerId={ownerId}
          onClose={() => setShowAdd(false)}
          onCreate={handleCreateItem}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  container: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerEyebrow: { color: MUTED, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { color: INK, fontSize: 28, fontWeight: '900' },
  headerActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: '#1a110a',
  },
  alertBtn: {
    borderColor: '#f25f4c',
    // @ts-ignore
    boxShadow: '0 0 12px rgba(242,95,76,0.6)',
  },
  actionText: { color: INK, fontWeight: '600' },
  accentBtn: { backgroundColor: ACCENT, borderColor: ACCENT },

  banner: {
    backgroundColor: '#2a1b12',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    padding: 12,
  },
  bannerText: { color: '#FCD9AF' },
  errorBanner: { backgroundColor: '#4a1f1f', borderColor: '#FF6B6B' },
  errorText: { color: '#FFAEA5', fontWeight: '600' },

  offerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 6 },
  flashyButton: {
    backgroundColor: '#da8b3d',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '0 6px 16px rgba(218,139,61,0.5)',
  },
  flashyButtonText: { color: '#1b0e06', fontWeight: '900', letterSpacing: 1 },
  resetLink: { paddingHorizontal: 6, paddingVertical: 4 },
  resetLinkText: { color: MUTED, textDecorationLine: 'underline', fontSize: 12 },
  disabledBtn: { opacity: 0.6 },


  sectionTitle: { color: INK, fontSize: 18, fontWeight: '800' },
  sectionHint: { color: MUTED, fontSize: 13 },
  mutedText: { color: MUTED },

  rail: {
    backgroundColor: '#150c06',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#302017',
    padding: 16,
    gap: 14,
  },
  inventoryRail: {
    backgroundColor: '#0f0804',
  },
  railHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  railCounters: { alignItems: 'flex-end' },
  counterText: { color: MUTED, fontSize: 12 },
  railScroll: { paddingRight: 14, paddingLeft: 2 },

  emptyState: {
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  board: { gap: 18 },
  duelMat: {
    backgroundColor: '#0d0804',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2d1a12',
    padding: 16,
    gap: 12,
  },
  matRow: { gap: 6 },
  matRowTitle: { color: INK, fontWeight: '700', fontSize: 14 },
  matEmpty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  matEmptyText: { color: MUTED, fontSize: 12 },
  matCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  matCard: {
    width: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3b2517',
    backgroundColor: '#1a0e07',
    overflow: 'hidden',
  },
  matCardImage: { width: '100%', height: 70 },
  matCardPlaceholder: { width: '100%', height: 70, alignItems: 'center', justifyContent: 'center' },
  matCardPlaceholderText: { color: MUTED, fontSize: 12 },
  matCardName: { color: INK, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12 },

  cardWrapper: { width: 220, marginRight: 14 },
  cardShell: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3a2417',
    backgroundColor: '#1d120c',
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '0 8px 22px rgba(0,0,0,0.45)',
  },
  cardShellSelected: {
    borderColor: ACCENT,
    transform: [{ translateY: 6 }],
  },
  cardImageWrap: {
    width: '100%',
    height: 140,
    backgroundColor: '#2b1d13',
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  noImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noImageText: { color: MUTED },
  deleteBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBadgeText: { color: '#fff', fontWeight: '800' },
  cardBody: { padding: 12, gap: 8 },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardName: { color: INK, fontSize: 16, fontWeight: '800', flex: 1 },
  cardTag: {
    color: '#f3c37a',
    fontWeight: '600',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#f3c37a33',
  },
  cardDesc: { color: MUTED, fontSize: 12 },
  cardOwner: { color: '#D7C0A8', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
});

