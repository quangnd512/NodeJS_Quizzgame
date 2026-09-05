// Man hinh thi dau PvP — hien thi cau hoi realtime, nhan dap an.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import {
  getBattleSocket,
  disconnectBattleSocket,
  type BattleQuestionEvent,
  type BattleQuestionResultEvent,
  type BattleOpponentProgressEvent,
  type BattleMatchEndedEvent,
  type BattleErrorEvent,
  type BattleOpponentDisconnectedEvent,
} from '../../battle/battleSocket';
import type { ProfileStackScreenProps } from '../../navigation/types';
import type { Socket } from 'socket.io-client';

type Props = ProfileStackScreenProps<'BattleSession'>;

export function BattleSessionScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const { matchId, opponentName, stake, subject } = route.params;

  const [currentQ, setCurrentQ] = useState<BattleQuestionEvent | null>(null);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [qResult, setQResult] = useState<BattleQuestionResultEvent | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [waiting, setWaiting] = useState(true); // cho cau hoi dau tien

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  /**
   * Bắt đầu đếm ngược thời gian cho câu hỏi mới.
   * Luôn clear interval cũ trước khi tạo mới — tránh nhiều interval chạy song song.
   */
  const startTimer = useCallback((limit: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(limit);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    if (!sessionToken) return;

    const socket = getBattleSocket(sessionToken);
    socketRef.current = socket;

    socket.on('battle:question', (data: BattleQuestionEvent) => {
      if (!isMounted.current) return;
      setCurrentQ(data);
      setSelectedOpt(null);
      setQResult(null);
      setWaiting(false);
      startTimer(data.timeLimit);
    });

    socket.on('battle:question-result', (data: BattleQuestionResultEvent) => {
      if (!isMounted.current) return;
      setQResult(data);
      setMyScore(data.myScore);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on('battle:opponent-progress', (data: BattleOpponentProgressEvent) => {
      if (!isMounted.current) return;
      setOppScore(data.opponentScore);
    });

    socket.on('battle:match-ended', (data: BattleMatchEndedEvent) => {
      if (!isMounted.current) return;
      disconnectBattleSocket();
      navigation.replace('BattleResult', {
        matchId: data.matchId,
        myScore: data.myScore,
        opponentScore: data.opponentScore,
        result: data.result,
        pointsChange: data.pointsChange,
      });
    });

    socket.on('battle:opponent-disconnected', (_data: BattleOpponentDisconnectedEvent) => {
      if (isMounted.current) setOpponentDisconnected(true);
    });

    socket.on('battle:error', (data: BattleErrorEvent) => {
      if (!isMounted.current) return;
      Alert.alert('Lỗi thi đấu', data.message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    });

    return () => {
      isMounted.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      socket.off('battle:question');
      socket.off('battle:question-result');
      socket.off('battle:opponent-progress');
      socket.off('battle:match-ended');
      socket.off('battle:opponent-disconnected');
      socket.off('battle:error');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  /**
   * Xử lý khi người dùng chọn đáp án.
   * Guard `selectedOpt !== null` ngăn gửi 2 lần (race condition UI).
   */
  const handleSelect = (optIndex: number) => {
    if (selectedOpt !== null || qResult !== null || !currentQ) return;
    setSelectedOpt(optIndex);
    socketRef.current?.emit('battle:submit-answer', {
      matchId,
      questionIndex: currentQ.questionIndex,
      selectedOption: optIndex,
    });
  };

  const timerColor = timeLeft <= 5 ? colors.danger : timeLeft <= 10 ? '#d97706' : colors.text;

  const getOptStyle = (i: number) => {
    if (qResult === null) {
      return {
        borderColor: selectedOpt === i ? colors.primary : colors.border,
        backgroundColor: selectedOpt === i ? (colors.primary + '20') : colors.surface,
      };
    }
    // User trả lời đúng: highlight xanh cho đáp án đã chọn
    if (qResult.isCorrect && i === selectedOpt) {
      return { borderColor: '#16a34a', backgroundColor: '#dcfce7' };
    }
    // Server gửi correctAnswer rõ ràng: highlight xanh cho đáp án đúng
    if (qResult.correctAnswer !== null && i === qResult.correctAnswer) {
      return { borderColor: '#16a34a', backgroundColor: '#dcfce7' };
    }
    // User chọn sai: highlight đỏ
    if (i === selectedOpt && !qResult.isCorrect) {
      return { borderColor: colors.danger, backgroundColor: '#fee2e2' };
    }
    return { borderColor: colors.border, backgroundColor: colors.surface };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Score bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.scoreCol}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Bạn</Text>
          <Text style={[styles.scoreVal, { color: colors.primary }]}>{myScore}</Text>
        </View>
        <View style={styles.centerInfo}>
          <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}s</Text>
          <Text style={[styles.subjectText, { color: colors.textMuted }]}>{subject} · {stake}đ</Text>
        </View>
        <View style={[styles.scoreCol, { alignItems: 'flex-end' }]}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>{opponentName}</Text>
          <Text style={[styles.scoreVal, { color: colors.textMuted }]}>{oppScore}</Text>
        </View>
      </View>

      {opponentDisconnected && (
        <View style={[styles.disconnBanner, { backgroundColor: '#fef3c7' }]}>
          <Text style={styles.disconnText}>⚠️ Đối thủ mất kết nối — chờ 30s...</Text>
        </View>
      )}

      {waiting ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.waitText, { color: colors.textMuted }]}>Đang chờ câu hỏi...</Text>
        </View>
      ) : currentQ ? (
        <View style={styles.qArea}>
          <Text style={[styles.qIdx, { color: colors.textMuted }]}>
            Câu {currentQ.questionIndex + 1}/10
          </Text>
          <Text style={[styles.qText, { color: colors.text }]}>{currentQ.questionText}</Text>

          {currentQ.options && currentQ.options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.opt, getOptStyle(i)]}
              onPress={() => handleSelect(i)}
              disabled={selectedOpt !== null}
            >
              <Text style={[styles.optLabel, { color: colors.primary }]}>
                {['A', 'B', 'C', 'D'][i]}.
              </Text>
              <Text style={[styles.optText, { color: colors.text }]}>{opt}</Text>
            </TouchableOpacity>
          ))}

          {qResult && (
            <Text style={[styles.resultHint, { color: qResult.isCorrect ? '#16a34a' : colors.danger }]}>
              {qResult.isCorrect ? '✅ Đúng! Bạn được ' + qResult.myScore + ' điểm' : '❌ Sai rồi!'}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  scoreCol: { flex: 1 },
  scoreLabel: { fontSize: 12 },
  scoreVal: { fontSize: 20, fontWeight: '800' },
  centerInfo: { alignItems: 'center', flex: 1 },
  timerText: { fontSize: 22, fontWeight: '900' },
  subjectText: { fontSize: 11, marginTop: 2 },
  disconnBanner: { padding: 10, alignItems: 'center' },
  disconnText: { fontSize: 13, color: '#92400e', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  waitText: { fontSize: 14 },
  qArea: { flex: 1, padding: 16, gap: 12 },
  qIdx: { fontSize: 13 },
  qText: { fontSize: 17, fontWeight: '700', lineHeight: 26 },
  opt: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'flex-start',
    gap: 8,
  },
  optLabel: { fontWeight: '700', fontSize: 15, minWidth: 20 },
  optText: { flex: 1, fontSize: 15, lineHeight: 22 },
  resultHint: { fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 4 },
});
