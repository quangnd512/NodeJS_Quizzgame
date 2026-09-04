// Man hinh Lobby Battle PvP — chon mon, muc cuoc, vao hang doi hoac phong rieng.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext.js';
import { useAuth } from '../../auth/AuthContext.js';
import { getBattleConfig, type BattleConfigResponse } from '../../api/battle.js';
import { getBattleSocket, disconnectBattleSocket } from '../../battle/battleSocket.js';
import { SUBJECT_CATALOG } from '../../constants/subjects.js';
import type { ProfileStackScreenProps } from '../../navigation/types.js';
import type { BattleMatchFoundEvent, BattleQueueStatusEvent, BattleRoomCreatedEvent, BattleErrorEvent } from '../../battle/battleSocket.js';
import type { Socket } from 'socket.io-client';

type Props = ProfileStackScreenProps<'BattleLobby'>;
type Mode = 'select' | 'queue' | 'room-create' | 'room-join';

export function BattleLobbyScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [config, setConfig] = useState<BattleConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [stake, setStake] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('select');
  const [queueStatus, setQueueStatus] = useState<BattleQueueStatusEvent | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadConfig = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const cfg = await getBattleConfig(sessionToken);
      if (isMounted.current) {
        setConfig(cfg);
        if (cfg.stakes.length > 0) setStake(cfg.stakes[0] ?? null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải cấu hình.';
      Alert.alert('Lỗi', msg);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // Cleanup socket khi unmount
  useEffect(() => {
    return () => {
      disconnectBattleSocket();
    };
  }, []);

  const setupSocket = useCallback(() => {
    if (!sessionToken) return null;
    const socket = getBattleSocket(sessionToken);
    socketRef.current = socket;

    socket.on('battle:match-found', (data: BattleMatchFoundEvent) => {
      if (!isMounted.current) return;
      navigation.replace('BattleSession', {
        matchId: data.matchId,
        subject: data.subject,
        stake: data.stake,
        opponentName: data.opponentName,
        isBotMatch: data.isBotMatch,
      });
    });

    socket.on('battle:queue-status', (data: BattleQueueStatusEvent) => {
      if (isMounted.current) setQueueStatus(data);
    });

    socket.on('battle:room-created', (data: BattleRoomCreatedEvent) => {
      if (isMounted.current) setGeneratedCode(data.roomCode);
    });

    socket.on('battle:error', (data: BattleErrorEvent) => {
      if (!isMounted.current) return;
      Alert.alert('Lỗi thi đấu', data.message);
      setMode('select');
      setQueueStatus(null);
    });

    return socket;
  }, [sessionToken, navigation]);

  const handleJoinQueue = () => {
    if (!subject || !stake) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn môn học và mức cược.');
      return;
    }
    const socket = setupSocket();
    if (!socket) return;
    setMode('queue');
    socket.emit('battle:join-queue', { subject, stake });
  };

  const handleCancelQueue = () => {
    socketRef.current?.emit('battle:cancel-queue');
    disconnectBattleSocket();
    setMode('select');
    setQueueStatus(null);
  };

  const handleCreateRoom = () => {
    if (!subject || !stake) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn môn học và mức cược.');
      return;
    }
    const socket = setupSocket();
    if (!socket) return;
    setMode('room-create');
    socket.emit('battle:create-room', { subject, stake });
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      Alert.alert('Thiếu thông tin', 'Nhập mã phòng.');
      return;
    }
    const socket = setupSocket();
    if (!socket) return;
    setMode('room-join');
    socket.emit('battle:join-room', { roomCode: roomCode.trim().toUpperCase() });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>⚔️ Thi đấu PvP</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Waiting queue */}
        {mode === 'queue' && (
          <View style={[styles.waitBox, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.waitTitle, { color: colors.text }]}>Đang tìm đối thủ...</Text>
            {queueStatus && (
              <Text style={[styles.waitMeta, { color: colors.textMuted }]}>
                {queueStatus.waitingSeconds}s · {queueStatus.currentCriteria}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.danger }]}
              onPress={handleCancelQueue}
            >
              <Text style={[styles.cancelText, { color: colors.danger }]}>Hủy</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create room waiting */}
        {mode === 'room-create' && generatedCode && (
          <View style={[styles.waitBox, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <Text style={[styles.waitTitle, { color: colors.text }]}>Mã phòng của bạn:</Text>
            <Text style={[styles.roomCode, { color: colors.primary }]}>{generatedCode}</Text>
            <Text style={[styles.waitMeta, { color: colors.textMuted }]}>Chia sẻ mã cho bạn để vào phòng</Text>
          </View>
        )}

        {/* Main form */}
        {mode === 'select' && (
          <>
            {/* Points info */}
            {config && (
              <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Điểm hiện tại</Text>
                <Text style={[styles.infoVal, { color: colors.primary }]}>{config.currentPoints}</Text>
              </View>
            )}

            {/* Mon hoc */}
            <Text style={[styles.label, { color: colors.text }]}>Môn học</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {SUBJECT_CATALOG.map((s) => {
                  const active = s.id === subject;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                      onPress={() => setSubject(s.id)}
                    >
                      <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12 }}>
                        {s.emoji} {s.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Muc cuoc */}
            <Text style={[styles.label, { color: colors.text }]}>Mức cược</Text>
            <View style={styles.stakeRow}>
              {(config?.stakes ?? []).map((s) => {
                const active = s === stake;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.stakeBtn, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                    onPress={() => setStake(s)}
                  >
                    <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: '700' }}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Actions */}
            <TouchableOpacity
              style={[styles.mainBtn, { backgroundColor: colors.primary }]}
              onPress={handleJoinQueue}
            >
              <Text style={[styles.mainBtnText, { color: colors.primaryText }]}>🔍 Tìm đối thủ ngẫu nhiên</Text>
            </TouchableOpacity>

            <View style={styles.roomRow}>
              <TouchableOpacity
                style={[styles.halfBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleCreateRoom}
              >
                <Text style={[styles.halfBtnText, { color: colors.text }]}>🏠 Tạo phòng riêng</Text>
              </TouchableOpacity>
              <View style={styles.halfBtn}>
                <TextInput
                  style={[styles.codeInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                  placeholder="Mã phòng..."
                  placeholderTextColor={colors.textMuted}
                  value={roomCode}
                  onChangeText={setRoomCode}
                  autoCapitalize="characters"
                  maxLength={12}
                />
                <TouchableOpacity
                  style={[styles.joinRoomBtn, { backgroundColor: colors.primary }]}
                  onPress={handleJoinRoom}
                >
                  <Text style={[styles.joinRoomText, { color: colors.primaryText }]}>Vào</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  backText: { fontSize: 20 },
  title: { fontSize: 20, fontWeight: '800' },
  scroll: { padding: 16, gap: 16 },
  waitBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    gap: 12,
  },
  waitTitle: { fontSize: 18, fontWeight: '700' },
  waitMeta: { fontSize: 13 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  cancelText: { fontWeight: '700', fontSize: 14 },
  roomCode: { fontSize: 36, fontWeight: '900', letterSpacing: 4 },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoLabel: { fontSize: 14 },
  infoVal: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 14, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  stakeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stakeBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  mainBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  mainBtnText: { fontWeight: '800', fontSize: 16 },
  roomRow: { flexDirection: 'row', gap: 10 },
  halfBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  halfBtnText: { fontWeight: '600', fontSize: 14, textAlign: 'center' },
  codeInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  joinRoomBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  joinRoomText: { fontWeight: '700', fontSize: 14 },
});
