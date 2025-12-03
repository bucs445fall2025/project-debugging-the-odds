import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AuthUser } from '@/App';
import {
  createTrade,
  fetchPendingTrades,
  fetchSentTrades,
  fetchUserProfile,
  getItemsByOwner,
  imageUrl,
  ItemRecord,
  TradeRecord,
  updateTradeStatus,
} from '@/api';

type Props = {
  user: AuthUser;
  onBack: () => void;
  onSignOut: () => void;
  onNotificationChange?: (hasAlerts: boolean) => void;
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

export default function PendingOffers({ user, onBack, onSignOut, onNotificationChange }: Props) {
  const ownerId = useMemo(() => cleanGuid(getUserIdFromToken(user.token)), [user.token]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const [myItems, setMyItems] = useState<ItemRecord[]>([]);
  const [otherItems, setOtherItems] = useState<ItemRecord[]>([]);
  const [selectedMine, setSelectedMine] = useState<string[]>([]);
  const [selectedTheirs, setSelectedTheirs] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sentTrades, setSentTrades] = useState<TradeRecord[]>([]);
  const [dismissedSent, setDismissedSent] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem('dismissedSentTrades');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [userProfiles, setUserProfiles] = useState<Record<string, { name: string | null; email: string }>>({});
  const fetchingProfiles = useRef<Set<string>>(new Set());
  const [selectedSentId, setSelectedSentId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('dismissedSentTrades', JSON.stringify(dismissedSent));
    } catch {
      // ignore
    }
  }, [dismissedSent]);

  const activeTrade = trades.find((trade) => trade.id === activeTradeId) || null;
  const selectedSentTrade = useMemo(
    () =>
      sentTrades.find(
        (trade) =>
          trade.id === selectedSentId &&
          trade.status !== 'Requested' &&
          !dismissedSent.includes(trade.id),
      ) || null,
    [selectedSentId, sentTrades, dismissedSent],
  );
  const detailTrade = activeTrade ?? selectedSentTrade ?? null;
  const isIncomingDetail = Boolean(activeTrade);

  const loadTrades = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPendingTrades(ownerId);
      setTrades(data);
      if (!activeTradeId && data.length > 0) {
        setActiveTradeId(data[0].id);
      } else if (activeTradeId && !data.some((trade) => trade.id === activeTradeId)) {
        setActiveTradeId(data[0]?.id ?? null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Unable to load pending offers: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [ownerId, activeTradeId]);

  const loadSentTrades = useCallback(async () => {
    if (!ownerId) return;
    try {
      const data = await fetchSentTrades(ownerId);
      setSentTrades(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError((prev) => prev ?? `Unable to load sent offers: ${message}`);
    }
  }, [ownerId]);

  useEffect(() => {
    loadTrades();
    loadSentTrades();
  }, [loadTrades, loadSentTrades]);

  useEffect(() => {
    if (activeTradeId || selectedSentId) return;
    const firstUpdate = sentTrades.find(
      (trade) => trade.status !== 'Requested' && !dismissedSent.includes(trade.id),
    );
    if (firstUpdate) setSelectedSentId(firstUpdate.id);
  }, [sentTrades, dismissedSent, activeTradeId, selectedSentId]);

  useEffect(() => {
    if (selectedSentId && !sentTrades.some((trade) => trade.id === selectedSentId)) {
      setSelectedSentId(null);
    }
  }, [sentTrades, selectedSentId]);

  useEffect(() => {
    if (!ownerId) return;
    getItemsByOwner(ownerId).then(setMyItems).catch(() => {});
  }, [ownerId]);

  useEffect(() => {
    if (!activeTrade) {
      setOtherItems([]);
      return;
    }
    const targetId =
      cleanGuid(activeTrade.initiatorId) ||
      cleanGuid(activeTrade.offeringItems[0]?.ownerId);
    if (!targetId) {
      setOtherItems(activeTrade.offeringItems);
      return;
    }
    getItemsByOwner(targetId)
      .then((items) => {
        const missing = activeTrade.offeringItems.filter(
          (item) => !items.some((existing) => existing.id === item.id),
        );
        setOtherItems([...items, ...missing]);
      })
      .catch(() => {
        setOtherItems(activeTrade.offeringItems);
      });
    setSelectedMine([]);
    setSelectedTheirs([]);
  }, [activeTrade]);

  useEffect(() => {
    const ids = new Set<string>();
    trades.forEach((trade) => {
      if (trade.initiatorId) ids.add(trade.initiatorId);
    });
    sentTrades.forEach((trade) => {
      if (trade.initiatorId) ids.add(trade.initiatorId);
      if (trade.receiverId) ids.add(trade.receiverId);
    });
    ids.forEach((id) => {
      if (!id) return;
      if (userProfiles[id] || fetchingProfiles.current.has(id)) return;
      fetchingProfiles.current.add(id);
      fetchUserProfile(id)
        .then((profile) => {
          setUserProfiles((prev) => ({ ...prev, [id]: profile }));
        })
        .catch(() => {})
        .finally(() => fetchingProfiles.current.delete(id));
    });
  }, [trades, sentTrades, userProfiles]);

  useEffect(() => {
    if (!onNotificationChange) return;
    const hasIncoming = trades.length > 0;
    const hasSentUpdates = sentTrades.some(
      (trade) => trade.status !== 'Requested' && !dismissedSent.includes(trade.id),
    );
    onNotificationChange(hasIncoming || hasSentUpdates);
  }, [trades, sentTrades, dismissedSent, onNotificationChange]);

  const toggleMine = (item: ItemRecord) => {
    setSelectedMine((prev) =>
      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
    );
  };

  const toggleTheirs = (item: ItemRecord) => {
    setSelectedTheirs((prev) =>
      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
    );
  };

  const acceptTrade = async () => {
    if (!ownerId || !activeTrade) return;
    setSending(true);
    try {
      await updateTradeStatus({ tradeId: activeTrade.id, receiverId: ownerId, status: 'Accepted' });
      setStatusMessage('Trade accepted. The initiator has been notified.');
      await Promise.all([loadTrades(), loadSentTrades()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const rejectTrade = async () => {
    if (!ownerId || !activeTrade) return;
    setSending(true);
    try {
      await updateTradeStatus({ tradeId: activeTrade.id, receiverId: ownerId, status: 'Rejected' });
      setStatusMessage('Trade rejected. The initiator has been notified.');
      await Promise.all([loadTrades(), loadSentTrades()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const counterTrade = async () => {
    if (!ownerId || !activeTrade) return;
    if (selectedMine.length === 0 || selectedTheirs.length === 0) {
      setError('Select at least one of your items and theirs to counter.');
      return;
    }
    const receiverId =
      cleanGuid(activeTrade.initiatorId) ||
      cleanGuid(activeTrade.offeringItems[0]?.ownerId) ||
      cleanGuid(
        otherItems.find((item) => item.id === selectedTheirs[0])?.ownerId ??
        activeTrade.seekingItems[0]?.ownerId,
      );
    if (!receiverId) {
      setError('Unable to determine the other trader for this counter.');
      return;
    }
    setSending(true);
    try {
      await createTrade({
        initiatorId: ownerId,
        receiverId,
        offeringItemIds: selectedMine,
        seekingItemIds: selectedTheirs,
      });
      await updateTradeStatus({ tradeId: activeTrade.id, receiverId: ownerId, status: 'Countered' });
      setStatusMessage('Counter offer sent.');
      setSelectedMine([]);
      setSelectedTheirs([]);
      await Promise.all([loadTrades(), loadSentTrades()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const getDisplayName = useCallback((userId?: string | null) => {
    if (!userId) return 'Unknown trader';
    const profile = userProfiles[userId];
    if (profile?.name) {
      const parts = profile.name.trim().split(/\s+/);
      const first = parts[0];
      const lastInitial = parts[1]?.[0];
      if (first && lastInitial) return `${first} ${lastInitial}.`;
      if (first) return first;
    }
    if (profile?.email) {
      return profile.email.split('@')[0] || `Trader ${shortId(userId)}`;
    }
    return `Trader ${shortId(userId)}`;
  }, [userProfiles]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>Signed in as {user.email}</Text>
          <Text style={styles.headerTitle}>Pending Offers</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              loadTrades();
              loadSentTrades();
            }}
          >
            <Text style={styles.actionText}>Refresh</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onBack}>
            <Text style={styles.actionText}>Back to Trading Floor</Text>
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
      {statusMessage ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{statusMessage}</Text>
        </View>
      ) : null}

      <View style={styles.content}>
        <View style={styles.listPane}>
          <Text style={styles.listTitle}>Offers awaiting review</Text>
          {loading ? (
            <Text style={styles.muted}>Loading...</Text>
          ) : trades.length === 0 ? (
            <Text style={styles.muted}>No pending offers right now.</Text>
          ) : (
            trades.map((trade) => (
              <Pressable
                key={trade.id}
                style={[styles.listItem, trade.id === activeTradeId && styles.listItemActive]}
                onPress={() => {
                  setActiveTradeId(trade.id);
                  setSelectedSentId(null);
                }}
              >
                <Text style={styles.listItemTitle}>{getDisplayName(trade.initiatorId)}</Text>
                <Text style={styles.listItemMeta}>
                  {trade.offeringItems.length} offering / {trade.seekingItems.length} requested
                </Text>
                <Text style={styles.listItemStatus}>{trade.status}</Text>
              </Pressable>
            ))
          )}

          <View style={styles.sentBlock}>
            <Text style={styles.listTitle}>Your sent offers</Text>
            {sentTrades.filter((trade) => trade.status !== 'Requested' && !dismissedSent.includes(trade.id)).length === 0 ? (
              <Text style={styles.muted}>No updates yet.</Text>
            ) : (
              sentTrades
                .filter((trade) => trade.status !== 'Requested' && !dismissedSent.includes(trade.id))
                .map((trade) => (
                  <Pressable
                    key={trade.id}
                    style={[
                      styles.listItem,
                      styles.sentItem,
                      selectedSentId === trade.id && styles.listItemActive,
                    ]}
                    onPress={() => {
                      setSelectedSentId(trade.id);
                      setActiveTradeId(null);
                    }}
                  >
                    <Text style={styles.listItemTitle}>{getDisplayName(trade.receiverId)}</Text>
                    <Text style={styles.listItemStatus}>{trade.status}</Text>
                    <Pressable
                      style={styles.dismissBtn}
                      onPress={() => {
                        setDismissedSent((prev) => [...prev, trade.id]);
                        if (selectedSentId === trade.id) setSelectedSentId(null);
                      }}
                    >
                      <Text style={styles.dismissText}>Dismiss</Text>
                    </Pressable>
                  </Pressable>
                ))
            )}
          </View>
        </View>

        <View style={styles.detailPane}>
          {detailTrade ? (
            <>
              <Text style={styles.sectionHeading}>
                {isIncomingDetail
                  ? `Original offer from ${getDisplayName(detailTrade.initiatorId)}`
                  : `You offered ${getDisplayName(detailTrade.receiverId)}`}
              </Text>
              <View style={styles.duelMat}>
                <MatRow
                  title={isIncomingDetail ? 'Their offer' : 'What you would send'}
                  items={detailTrade.offeringItems}
                />
                <MatRow
                  title={isIncomingDetail ? 'Requested from you' : 'What you requested'}
                  items={detailTrade.seekingItems}
                />
              </View>

              {isIncomingDetail ? (
                <>
                  <View style={styles.actionsRow}>
                    <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={rejectTrade} disabled={sending}>
                      <Text style={styles.rejectText}>{sending ? 'Working...' : 'Reject'}</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.acceptBtn]} onPress={acceptTrade} disabled={sending}>
                      <Text style={styles.acceptText}>{sending ? 'Working...' : 'Accept'}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.counterSection}>
                    <Text style={styles.sectionHeading}>Counter offer</Text>
                    <Text style={styles.mutedSmall}>
                      Select cards from both sides to craft a new proposal.
                    </Text>

                    <View style={styles.counterLanes}>
                      <View style={styles.counterColumn}>
                        <Text style={styles.counterTitle}>Your cards</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.counterScroll}>
                          {myItems.map((item) => (
                            <SelectCard
                              key={item.id}
                              item={item}
                              selected={selectedMine.includes(item.id)}
                              onPress={() => toggleMine(item)}
                            />
                          ))}
                        </ScrollView>
                      </View>
                      <View style={styles.counterColumn}>
                        <Text style={styles.counterTitle}>Their cards</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.counterScroll}>
                          {otherItems.map((item) => (
                            <SelectCard
                              key={item.id}
                              item={item}
                              selected={selectedTheirs.includes(item.id)}
                              onPress={() => toggleTheirs(item)}
                            />
                          ))}
                        </ScrollView>
                      </View>
                    </View>

                    <Pressable
                      style={[styles.flashyButton, styles.counterButton, sending && styles.disabledBtn]}
                      onPress={counterTrade}
                      disabled={sending}
                    >
                      <Text style={styles.flashyButtonText}>
                        {sending ? 'Sending counter...' : 'Send counter offer'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={styles.mutedSmall}>
                  Status: {detailTrade.status}. You can dismiss this update once noted.
                </Text>
              )}
            </>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.muted}>Select an offer from the list to review its details.</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function MatRow({ title, items }: { title: string; items: ItemRecord[] }) {
  return (
    <View style={styles.matRow}>
      <Text style={styles.matRowTitle}>{title}</Text>
      {items.length === 0 ? (
        <View style={styles.matEmpty}>
          <Text style={styles.matEmptyText}>No cards placed.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matCards}>
          {items.map((card) => (
            <View key={card.id} style={styles.matCard}>
              {card.imageKeys[0] ? (
                <Image source={{ uri: imageUrl(card.imageKeys[0]) }} style={styles.matCardImage} resizeMode="cover" />
              ) : (
                <View style={styles.matCardPlaceholder}>
                  <Text style={styles.matCardPlaceholderText}>No photo</Text>
                </View>
              )}
              <Text style={styles.matCardName} numberOfLines={1}>
                {card.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SelectCard({ item, selected, onPress }: { item: ItemRecord; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.selectCard, selected && styles.selectCardSelected]}>
      {item.imageKeys[0] ? (
        <Image source={{ uri: imageUrl(item.imageKeys[0]) }} style={styles.selectCardImage} resizeMode="cover" />
      ) : (
        <View style={styles.matCardPlaceholder}>
          <Text style={styles.matCardPlaceholderText}>No photo</Text>
        </View>
      )}
      <Text style={styles.selectCardName} numberOfLines={1}>
        {item.name}
      </Text>
    </Pressable>
  );
}

const PANEL = '#140d08';
const BORDER = '#2d1c11';
const INK = '#F5EDE3';
const MUTED = '#CDBCA8';
const ACCENT = '#B8743A';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080604', padding: 24, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
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
  actionText: { color: INK, fontWeight: '600' },

  banner: {
    backgroundColor: '#2a1b12',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    padding: 12,
  },
  errorBanner: { backgroundColor: '#4a1f1f', borderColor: '#FF6B6B' },
  errorText: { color: '#FFAEA5', fontWeight: '600' },
  bannerText: { color: '#FCD9AF' },

  content: { flex: 1, flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  listPane: {
    width: 260,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: '#120a06',
    padding: 16,
    gap: 10,
  },
  listTitle: { color: INK, fontWeight: '700', fontSize: 16 },
  listItem: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    padding: 12,
    gap: 4,
  },
  listItemActive: { borderColor: ACCENT, backgroundColor: '#1d1008' },
  listItemTitle: { color: INK, fontWeight: '700' },
  listItemMeta: { color: MUTED, fontSize: 12 },
  listItemStatus: { color: '#f3c37a', fontSize: 12, textTransform: 'uppercase' },
  muted: { color: MUTED },
  sentBlock: { marginTop: 18, gap: 8 },
  sentItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dismissBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  dismissText: { color: MUTED, fontSize: 12 },

  detailPane: {
    flex: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: PANEL,
    padding: 18,
    gap: 16,
    minWidth: 300,
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mutedSmall: { color: MUTED, fontSize: 12 },

  sectionHeading: { color: INK, fontSize: 18, fontWeight: '800' },
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
  matCards: { flexDirection: 'row', flexWrap: 'nowrap', gap: 10 },
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

  actionsRow: { flexDirection: 'row', gap: 10 },
  acceptBtn: { backgroundColor: '#214f32' },
  acceptText: { color: '#b5ffd0', fontWeight: '700' },
  rejectBtn: { backgroundColor: '#4b1d1d' },
  rejectText: { color: '#ffc7c1', fontWeight: '700' },

  counterSection: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    padding: 12,
    gap: 10,
  },
  counterLanes: { gap: 12 },
  counterColumn: { gap: 6 },
  counterTitle: { color: INK, fontWeight: '700' },
  counterScroll: { gap: 10 },
  selectCard: {
    width: 150,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a1f14',
    overflow: 'hidden',
  },
  selectCardSelected: { borderColor: ACCENT, transform: [{ translateY: 4 }] },
  selectCardImage: { width: '100%', height: 90 },
  selectCardName: { color: INK, padding: 8, fontSize: 12 },
  flashyButton: {
    backgroundColor: '#da8b3d',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    // @ts-ignore
    boxShadow: '0 6px 16px rgba(218,139,61,0.5)',
  },
  counterButton: { alignSelf: 'flex-end', marginTop: 6 },
  flashyButtonText: { color: '#1b0e06', fontWeight: '900', letterSpacing: 1 },
  disabledBtn: { opacity: 0.6 },
});
