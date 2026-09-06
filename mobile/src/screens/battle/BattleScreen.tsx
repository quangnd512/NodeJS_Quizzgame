// Man hinh Thi dau doi khang (PvP Battle) — xu ly 4 giai doan: setup → queue → play → ket qua.
// Su dung Socket.io namespace "/battle" (xem battleSocket.ts) cho giai doan realtime.
// Tham khao: frontend/src/screens/battle/BattlePage.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { getBattleConfig, getActiveBattleMatch } from '../../api/battle';
import type { BattleConfig } from '../../api/battle';
import { createBattleSocket } from '../../battle/battleSocket';
import type {
  BattleSocket,
  BattleMatchFoundPayload,
  BattleQuestionPayload,
  BattleQuestionResultPayload,
  BattleMatchEndedPayload,
  BattleOpponentProgressPayload,
  BattleOpponentDisconnectedPayload,
} from '../../battle/battleSocket';
import { SUBJECT_CATALOG } from '../../constants/subjects';
import type { BattleStackScreenProps } from '../../navigation/types';

type Props = BattleStackScreenProps<'BattleHome'>;

type Phase = 'loading' | 'setup' | 'queue' | 'play';

interface QuestionState {
  index: number;
  text: string;
  options: [string, string, string, string];
  receivedAt: number;
  selected: number | null;
  correctOption: number | null;
  myPointsEarned: number | null;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const QUEUE_CRITERIA_LABEL: Record<string, string> = {
  STRICT: 'Khớp chính xác',
  SUBJECT_ONLY: 'Cùng môn học',
  ANY: 'Ghép nhanh',
};

export function BattleScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { sessionToken, profile } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [config, setConfig] = useState<BattleConfig | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedStake, setSelectedStake] = useState(0);
  const [socketReady, setSocketReady] = useState(false);
  const [socketError, setSocketError] = useState('');
  const [waitingSecs, setWaitingSecs] = useState(0);
  const [queueCriteria, setQueueCriteria] = useState('STRICT');
  const [matchInfo, setMatchInfo] = useState<BattleMatchFoundPayload | null>(null);
  const [question, setQuestion] = useState<QuestionState | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [gracePeriodLeft, setGracePeriodLeft] = useState(0);

  const socketRef = useRef<BattleSocket | null>(null);
  const gracePeriodRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref lu matchInfo de tranh stale closure trong socket event handler cua connectSocket
  const matchInfoRef = useRef<BattleMatchFoundPayload | null>(null);

  // Load config + kiem tra tran dang do
  useEffect(() => {
    if (!sessionToken) return;
    Promise.all([
      getBattleConfig(sessionToken),
      getActiveBattleMatch(sessionToken),
    ])
      .then(([cfg, activeRes]) => {
        setConfig(cfg);
        if (activeRes.active && activeRes.match) {
          const snap = activeRes.match;
          // Co tran dang do -> setup lai de rejoin
          setSelectedSubject(snap.subject);
          setSelectedStake(snap.stake);
          setPhase('setup');
          Alert.alert(
            '🔄 Trận đấu đang dở',
            `Bạn đang có trận chưa hoàn thành (${snap.opponentName}). Vào lại để tiếp tục.`,
          );
        } else {
          setPhase('setup');
        }
      })
      .catch(() => { setPhase('setup'); });
  }, [sessionToken]);

  // Ket noi socket va dat up cac event handler
  const connectSocket = useCallback(() => {
    if (!sessionToken) return;
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = createBattleSocket(sessionToken);
    socketRef.current = socket;

    socket.on('connect', () => { setSocketReady(true); setSocketError(''); });
    socket.on('disconnect', () => { setSocketReady(false); });
    socket.on('connect_error', (err) => {
      setSocketError(err.message || 'Không thể kết nối đến máy chủ thi đấu.');
    });

    socket.on('battle:error', (payload) => {
      if (payload.code === 'BATTLE_ALREADY_IN_MATCH') {
        Alert.alert('Đang trong trận', payload.message);
      } else {
        Alert.alert('Lỗi', payload.message);
      }
    });

    socket.on('battle:queue-status', (payload) => {
      setWaitingSecs(payload.waitingSeconds);
      setQueueCriteria(payload.currentCriteria);
    });

    socket.on('battle:match-found', (payload) => {
      matchInfoRef.current = payload;  // cap nhat ref truoc khi setState de event handler tiep theo dung gia tri moi
      setMatchInfo(payload);
      setMyScore(0);
      setOpponentScore(0);
      setPhase('play');
    });

    socket.on('battle:question', (payload: BattleQuestionPayload) => {
      setQuestion({
        index: payload.questionIndex,
        text: payload.questionText,
        options: payload.options,
        receivedAt: 0, // mobile: khong can do timing chinh xac
        selected: null,
        correctOption: null,
        myPointsEarned: null,
      });
    });

    socket.on('battle:opponent-progress', (payload: BattleOpponentProgressPayload) => {
      setOpponentScore(payload.opponentScore);
    });

    socket.on('battle:question-result', (payload: BattleQuestionResultPayload) => {
      setQuestion((q) => q && q.index === payload.questionIndex
        ? { ...q, correctOption: payload.correctOption, myPointsEarned: payload.myPointsEarned }
        : q,
      );
      setMyScore(payload.myTotalScore);
    });

    socket.on('battle:match-ended', (payload: BattleMatchEndedPayload) => {
      // Dung matchInfoRef (khong phai matchInfo state) de tranh stale closure:
      // matchInfo = null luc connectSocket chay, nhung ref luon duoc cap nhat khi nhan match-found.
      navigation.replace('BattleResult', {
        ended: payload,
        opponentName: matchInfoRef.current?.opponentName ?? 'Đối thủ',
      });
      socket.disconnect();
    });

    socket.on('battle:opponent-disconnected', (payload: BattleOpponentDisconnectedPayload) => {
      setOpponentDisconnected(true);
      setGracePeriodLeft(payload.gracePeriodSeconds);
      if (gracePeriodRef.current) clearInterval(gracePeriodRef.current);
      gracePeriodRef.current = setInterval(() => {
        setGracePeriodLeft((t) => {
          if (t <= 1) {
            if (gracePeriodRef.current) clearInterval(gracePeriodRef.current);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    });

    socket.connect();
  }, [sessionToken, navigation]); // matchInfo khong can trong deps: dung matchInfoRef thay the de tranh stale closure va tranh socket bi reconnect khi match found

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      if (gracePeriodRef.current) clearInterval(gracePeriodRef.current);
    };
  }, []);

  function handleJoinQueue() {
    if (!socketRef.current?.connected) {
      Alert.alert('Chưa kết nối', 'Vui lòng đợi kết nối đến máy chủ thi đấu.');
      return;
    }
    if (!selectedSubject || !selectedStake) {
      Alert.alert('Chọn môn và mức cược', 'Hãy chọn môn học và mức cược trước khi vào hàng chờ.');
      return;
    }
    socketRef.current.emit('battle:join-queue', { subject: selectedSubject, stake: selectedStake });
    setPhase('queue');
  }

  function handleCancelQueue() {
    socketRef.current?.emit('battle:cancel-queue');
    setPhase('setup');
    setWaitingSecs(0);
  }

  function handleSelectOption(optionIdx: number) {
    if (!socketRef.current || !matchInfo || !question || question.selected !== null) return;
    setQuestion((q) => q ? { ...q, selected: optionIdx } : q);
    // clientTimeMs = 0 tren mobile (backend khong yeu cau chinh xac cao; timing frontend la
    // best-effort, chi dung de rank score neu 2 nguoi dung tra loi cung trong 1 giay)
    socketRef.current.emit('battle:submit-answer', {
      matchId: matchInfo.matchId,
      questionIndex: question.index,
      selectedOption: optionIdx,
      clientTimeMs: 0,
    });
  }

  // ─── Render theo phase ─────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const mySubjects = SUBJECT_CATALOG.filter(
    (s) => profile?.subjects.some((ps) => ps.id === s.id),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header chung */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            if (phase === 'play') {
              Alert.alert('Rời trận?', 'Rời trận sẽ bị tính thua. Bạn chắc chắn?', [
                { text: 'Ở lại', style: 'cancel' },
                { text: 'Rời', style: 'destructive', onPress: () => { socketRef.current?.disconnect(); navigation.goBack(); } },
              ]);
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backBtn}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>⚔️ Thi đấu đối kháng</Text>
      </View>

      {/* ─── SETUP phase ─── */}
      {phase === 'setup' && (
        <ScrollView contentContainerStyle={styles.setupContent}>
          {/* Ket noi socket */}
          {!socketReady && (
            <TouchableOpacity
              style={[styles.connectBtn, { backgroundColor: colors.primary }]}
              onPress={connectSocket}
            >
              {socketError ? (
                <Text style={styles.connectBtnText}>⚠️ {socketError} — Thử lại</Text>
              ) : (
                <Text style={styles.connectBtnText}>🔌 Kết nối máy chủ thi đấu</Text>
              )}
            </TouchableOpacity>
          )}
          {socketReady && (
            <View style={[styles.connectedBadge, { backgroundColor: '#16a34a20', borderColor: '#16a34a' }]}>
              <Text style={{ color: '#16a34a', fontWeight: '700', fontSize: 13 }}>🟢 Đã kết nối</Text>
            </View>
          )}

          {/* Thong tin thanh toan va diem */}
          {config && (
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>💰 Số dư hiện tại</Text>
              <Text style={[styles.infoPoints, { color: colors.primary }]}>{config.currentPoints} điểm</Text>
            </View>
          )}

          {/* Chon mon hoc */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CHỌN MÔN</Text>
          <View style={styles.chipGrid}>
            {mySubjects.map((s) => {
              const isActive = selectedSubject === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, { backgroundColor: isActive ? colors.primary : colors.surface, borderColor: isActive ? colors.primary : colors.border }]}
                  onPress={() => setSelectedSubject(isActive ? '' : s.id)}
                >
                  <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
                  <Text style={{ color: isActive ? colors.primaryText : colors.text, fontWeight: '600', fontSize: 13 }}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Chon muc cuoc */}
          {config && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CHỌN MỨC CƯỢC</Text>
              <View style={styles.chipGrid}>
                {config.stakes.map((stake) => {
                  const isActive = selectedStake === stake;
                  const canAfford = config.currentPoints >= stake;
                  return (
                    <TouchableOpacity
                      key={stake}
                      style={[styles.chip, {
                        backgroundColor: isActive ? colors.primary : colors.surface,
                        borderColor: isActive ? colors.primary : canAfford ? colors.border : colors.danger,
                        opacity: canAfford ? 1 : 0.5,
                      }]}
                      onPress={() => { if (canAfford) setSelectedStake(isActive ? 0 : stake); }}
                      disabled={!canAfford}
                    >
                      <Text style={{ color: isActive ? colors.primaryText : canAfford ? colors.text : colors.danger, fontWeight: '700', fontSize: 15 }}>
                        {stake}đ
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Nut vao hang cho */}
          <TouchableOpacity
            style={[styles.joinBtn, {
              backgroundColor: selectedSubject && selectedStake && socketReady ? colors.primary : colors.border,
            }]}
            onPress={handleJoinQueue}
            disabled={!selectedSubject || !selectedStake || !socketReady}
          >
            <Text style={styles.joinBtnText}>⚔️ Vào hàng chờ ghép trận</Text>
          </TouchableOpacity>

          {/* Luat choi ngan */}
          <View style={[styles.rulesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.rulesTitle, { color: colors.text }]}>📜 Luật chơi</Text>
            <Text style={[styles.rulesText, { color: colors.textMuted }]}>• 10 câu MCQ, mỗi câu 30 giây</Text>
            <Text style={[styles.rulesText, { color: colors.textMuted }]}>• Trả lời nhanh đúng → nhiều điểm hơn</Text>
            <Text style={[styles.rulesText, { color: colors.textMuted }]}>• Thắng nhận cược, thua mất cược</Text>
            <Text style={[styles.rulesText, { color: colors.textMuted }]}>• Ngắt kết nối 30s → thua</Text>
          </View>
        </ScrollView>
      )}

      {/* ─── QUEUE phase ─── */}
      {phase === 'queue' && (
        <View style={styles.queueContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.queueTitle, { color: colors.text }]}>Đang tìm đối thủ...</Text>
          <Text style={[styles.queueWait, { color: colors.textMuted }]}>
            {waitingSecs}s · {QUEUE_CRITERIA_LABEL[queueCriteria] ?? queueCriteria}
          </Text>
          <Text style={[styles.queueSubject, { color: colors.primary }]}>
            {SUBJECT_CATALOG.find((s) => s.id === selectedSubject)?.emoji} {SUBJECT_CATALOG.find((s) => s.id === selectedSubject)?.name} · Cược {selectedStake}đ
          </Text>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={handleCancelQueue}
          >
            <Text style={[styles.cancelBtnText, { color: colors.text }]}>Hủy</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── PLAY phase ─── */}
      {phase === 'play' && matchInfo && (
        <ScrollView contentContainerStyle={styles.playContent}>
          {/* Score board */}
          <View style={[styles.scoreBoard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.scoreCol}>
              <Text style={[styles.scoreName, { color: colors.text }]} numberOfLines={1}>Bạn</Text>
              <Text style={[styles.scoreVal, { color: colors.primary }]}>{myScore}</Text>
            </View>
            <View style={styles.scoreVs}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.textMuted }}>VS</Text>
            </View>
            <View style={styles.scoreCol}>
              <Text style={[styles.scoreName, { color: colors.text }]} numberOfLines={1}>
                {matchInfo.opponentName || 'Đối thủ'}
              </Text>
              <Text style={[styles.scoreVal, { color: '#dc2626' }]}>{opponentScore}</Text>
            </View>
          </View>

          {/* Banner ngat ket noi doi thu */}
          {opponentDisconnected && gracePeriodLeft > 0 && (
            <View style={[styles.disconnectBanner, { backgroundColor: '#f59e0b20', borderColor: '#f59e0b' }]}>
              <Text style={{ color: '#b45309', fontWeight: '700' }}>
                ⚠️ Đối thủ mất kết nối — còn {gracePeriodLeft}s để quay lại
              </Text>
            </View>
          )}

          {/* Cau hoi */}
          {question ? (
            <>
              <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.questionIdx, { color: colors.textMuted }]}>Câu {question.index + 1}/10</Text>
                <Text style={[styles.questionText, { color: colors.text }]}>{question.text}</Text>
              </View>

              {question.options.map((opt, idx) => {
                let bgColor = colors.surface;
                let borderColor = colors.border;
                const hasResult = question.correctOption !== null;
                if (hasResult) {
                  if (idx === question.correctOption) { bgColor = '#16a34a22'; borderColor = '#16a34a'; }
                  else if (idx === question.selected && idx !== question.correctOption) { bgColor = '#dc262622'; borderColor = '#dc2626'; }
                } else if (idx === question.selected) {
                  bgColor = colors.primary + '22'; borderColor = colors.primary;
                }
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.option, { backgroundColor: bgColor, borderColor }]}
                    onPress={() => handleSelectOption(idx)}
                    disabled={question.selected !== null || hasResult}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.optionLabel, { color: hasResult && idx === question.correctOption ? '#16a34a' : colors.text }]}>
                      {OPTION_LABELS[idx]}. {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {question.myPointsEarned !== null && (
                <View style={[styles.resultFeedback, { backgroundColor: question.myPointsEarned > 0 ? '#16a34a18' : '#dc262618', borderColor: question.myPointsEarned > 0 ? '#16a34a' : '#dc2626' }]}>
                  <Text style={{ color: question.myPointsEarned > 0 ? '#16a34a' : '#dc2626', fontWeight: '700', fontSize: 15 }}>
                    {question.myPointsEarned > 0 ? `✅ +${question.myPointsEarned} điểm` : '❌ Không có điểm'}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>Câu tiếp theo sẽ tự động hiện...</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.waitQuestion}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.waitText, { color: colors.textMuted }]}>Chờ câu hỏi...</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { padding: 4 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  setupContent: { padding: 20, gap: 14 },
  connectBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  connectBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  connectedBadge: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start' },
  infoCard: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoTitle: { fontSize: 14, fontWeight: '600' },
  infoPoints: { fontSize: 22, fontWeight: '800' },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  joinBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  rulesCard: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 4 },
  rulesTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  rulesText: { fontSize: 13, lineHeight: 20 },
  queueContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  queueTitle: { fontSize: 20, fontWeight: '800' },
  queueWait: { fontSize: 16 },
  queueSubject: { fontSize: 15, fontWeight: '600' },
  cancelBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  playContent: { padding: 16, gap: 12 },
  scoreBoard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 16 },
  scoreCol: { flex: 1, alignItems: 'center', gap: 4 },
  scoreName: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  scoreVal: { fontSize: 32, fontWeight: '900' },
  scoreVs: { paddingHorizontal: 12 },
  disconnectBanner: { borderWidth: 1.5, borderRadius: 10, padding: 12 },
  questionCard: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  questionIdx: { fontSize: 12, fontWeight: '600' },
  questionText: { fontSize: 15, fontWeight: '600', lineHeight: 24 },
  option: { flexDirection: 'row', borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 8 },
  optionLabel: { flex: 1, fontSize: 14, lineHeight: 22 },
  resultFeedback: { borderWidth: 1.5, borderRadius: 12, padding: 14, gap: 4 },
  waitQuestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  waitText: { fontSize: 15 },
});
