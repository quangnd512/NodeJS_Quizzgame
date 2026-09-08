// Man hinh Danh sach de thi — hien tat ca de thi (bao gom de admin moi tao) theo mon hoc.
// Bat dau phien thi bang nut "Bắt đầu thi".
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { startExam, getActiveExamSession, abandonExam, resumeExam } from '../../api/exam';
import type { ActiveExamSession } from '../../api/exam';
import { SUBJECT_CATALOG } from '../../constants/subjects';
import type { ExamStackScreenProps } from '../../navigation/types';

type Props = ExamStackScreenProps<'ExamList'>;

export function ExamListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { profile, sessionToken } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState('');
  const [activeSession, setActiveSession] = useState<ActiveExamSession | null>(null);
  const [loadingActive, setLoadingActive] = useState(true);
  const [startingSubject, setStartingSubject] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [noExamsSubjects, setNoExamsSubjects] = useState<Set<string>>(new Set());

  const mySubjects = SUBJECT_CATALOG.filter(
    (s) => profile?.subjects.some((ps) => ps.id === s.id),
  );

  // Lần đầu load — fetch phiên thi dở dang
  useEffect(() => {
    if (!sessionToken) return;
    getActiveExamSession(sessionToken)
      .then((res) => { setActiveSession(res.session); })
      .catch(() => { setActiveSession(null); })
      .finally(() => { setLoadingActive(false); });
  }, [sessionToken]);

  // Lần đầu focus: refresh activeSession + hiện dialog nếu có phiên dở dang.
  // Dùng useRef thay vì useState để tránh stale closure trong async callback:
  // setAlertShown(false) chạy nhưng closure vẫn thấy giá trị cũ → dialog không hiện lại.
  const alertShownRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!sessionToken) return;
      // Reset flag mỗi khi màn hình được focus (quay về từ ExamTaking)
      alertShownRef.current = false;

      getActiveExamSession(sessionToken)
        .then((res) => {
          // Nếu phiên đã expire (remainingSeconds < 0) → xóa
          if (res.session && res.session.remainingSeconds < 0) {
            setActiveSession(null);
            return;
          }

          setActiveSession(res.session);
          // Lưu vào local var để TypeScript biết non-null trong closure bên dưới
          const pendingSession = res.session;
          // Nếu có phiên dở dang + chưa hết hạn + chưa hiện dialog → hiện ngay
          if (pendingSession && pendingSession.remainingSeconds >= 0 && !alertShownRef.current) {
            Alert.alert(
              'Đang có phiên thi dở',
              `Bạn đang có phiên thi "${pendingSession.title}" chưa hoàn thành. Muốn tiếp tục hay hủy phiên cũ?`,
              [
                {
                  text: 'Tiếp tục phiên cũ',
                  style: 'cancel',
                  onPress: () => { void handleResumeExam(); },
                },
                {
                  text: 'Hủy phiên cũ',
                  style: 'destructive',
                  onPress: async () => {
                    if (!sessionToken) return;
                    try {
                      await abandonExam(sessionToken, pendingSession.id);
                      setActiveSession(null);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Không thể hủy phiên.';
                      Alert.alert('Lỗi', msg);
                    }
                  },
                },
              ],
            );
            alertShownRef.current = true;  // Đánh dấu đã hiện dialog trong lần focus này
          }
        })
        .catch(() => { setActiveSession(null); });
    }, [sessionToken, navigation, handleResumeExam]),  // alertShown đã xóa khỏi deps vì dùng ref
  );

  /**
   * Tiếp tục phiên thi đang dở — gọi /api/exam/resume để lấy đầy đủ câu hỏi,
   * rồi navigate ExamTaking. Cần full data (questions) nên không dùng ActiveExamSession.
   */
  async function handleResumeExam() {
    if (!sessionToken) return;
    try {
      const res = await resumeExam(sessionToken);
      if (res.session) {
        navigation.navigate('ExamTaking', { session: res.session });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tiếp tục phiên thi.';
      Alert.alert('Lỗi', msg);
    }
  }

  async function handleRefresh() {
    if (!sessionToken) return;
    setRefreshing(true);
    try {
      const res = await getActiveExamSession(sessionToken);
      setActiveSession(res.session);
    } catch {
      setActiveSession(null);
    } finally {
      setRefreshing(false);
      setLoadingActive(false);
    }
  }

  async function handleStartExam(subjectId: string) {
    if (!sessionToken) return;

    // Neu dang co phien thi do, hoi nguoi dung
    if (activeSession) {
      Alert.alert(
        'Đang có phiên thi dở',
        `Bạn đang có phiên thi "${activeSession.title}" chưa hoàn thành. Muốn tiếp tục hay hủy phiên cũ?`,
        [
          {
            text: 'Tiếp tục phiên cũ',
            style: 'cancel',
            onPress: () => { void handleResumeExam(); },
          },
          {
            text: 'Hủy phiên cũ',
            style: 'destructive',
            onPress: async () => {
              try {
                await abandonExam(sessionToken, activeSession.id);
                setActiveSession(null);
                await doStartExam(subjectId);
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Không thể hủy phiên.';
                Alert.alert('Lỗi', msg);
              }
            },
          },
        ],
      );
      return;
    }

    await doStartExam(subjectId);
  }

  async function doStartExam(subjectId: string) {
    if (!sessionToken) return;
    setStartingSubject(subjectId);

    // Auto-reset sau 30 giây (fallback nếu navigation bị block)
    const timeout = setTimeout(() => {
      setStartingSubject(null);
    }, 30000);

    try {
      const session = await startExam(sessionToken, subjectId);
      clearTimeout(timeout);
      navigation.navigate('ExamTaking', { session });
    } catch (err) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : 'Không thể bắt đầu thi.';

      // Nếu lỗi liên quan "không có đề thi" → disable chip
      if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('không có')) {
        setNoExamsSubjects((prev) => new Set([...prev, subjectId]));
        Alert.alert(
          'Chưa có đề thi',
          `Môn này chưa có đề thi nào. Vui lòng chọn môn khác.`,
        );
      } else {
        Alert.alert('Lỗi', msg);
      }
      setStartingSubject(null);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void handleRefresh(); }} />}
    >
      <Text style={[styles.title, { color: colors.text }]}>📝 Thi thử</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Chọn môn để bắt đầu bài thi ngẫu nhiên
      </Text>

      {/* Phien thi dang do */}
      {!loadingActive && activeSession && (
        <View style={[styles.activeCard, { backgroundColor: '#f59e0b18', borderColor: '#f59e0b' }]}>
          <Text style={{ color: '#b45309', fontWeight: '700', fontSize: 14 }}>
            ⏳ Phiên thi đang dở
          </Text>
          <Text style={{ color: '#b45309', fontSize: 13, marginTop: 4 }}>
            {activeSession.title} — còn {Math.ceil(activeSession.remainingSeconds / 60)} phút
          </Text>
          <TouchableOpacity
            style={[styles.resumeBtn, { backgroundColor: '#f59e0b' }]}
            onPress={() => {
              // Hiện dialog "Tiếp tục hay hủy phiên cũ"
              if (activeSession) {
                Alert.alert(
                  'Đang có phiên thi dở',
                  `Bạn đang có phiên thi "${activeSession.title}" chưa hoàn thành. Muốn tiếp tục hay hủy phiên cũ?`,
                  [
                    {
                      text: 'Tiếp tục phiên cũ',
                      style: 'cancel',
                      onPress: () => { void handleResumeExam(); },
                    },
                    {
                      text: 'Hủy phiên cũ',
                      style: 'destructive',
                      onPress: async () => {
                        if (!sessionToken) return;
                        try {
                          await abandonExam(sessionToken, activeSession.id);
                          setActiveSession(null);
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : 'Không thể hủy phiên.';
                          Alert.alert('Lỗi', msg);
                        }
                      },
                    },
                  ],
                );
              }
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Quản lý phiên →</Text>
          </TouchableOpacity>
        </View>
      )}

      {loadingActive && <ActivityIndicator color={colors.primary} />}

      {/* Chon mon hoc */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CHỌN MÔN</Text>

      <View style={styles.subjectGrid}>
        {mySubjects.map((s) => {
          const isActive = selectedSubject === s.id;
          const isDisabled = noExamsSubjects.has(s.id);
          return (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.subjectChip,
                {
                  backgroundColor: isDisabled ? colors.border : isActive ? colors.primary : colors.surface,
                  borderColor: isDisabled ? colors.border : isActive ? colors.primary : colors.border,
                  opacity: isDisabled ? 0.5 : 1,
                },
              ]}
              onPress={() => {
                if (!isDisabled) {
                  setSelectedSubject(isActive ? '' : s.id);
                }
              }}
              disabled={isDisabled}
            >
              <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
              <Text
                style={{
                  color: isDisabled ? colors.textMuted : isActive ? colors.primaryText : colors.text,
                  fontWeight: '600',
                  fontSize: 13,
                }}
              >
                {s.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Nut bat dau */}
      {selectedSubject ? (
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: colors.primary }]}
          onPress={() => { void handleStartExam(selectedSubject); }}
          disabled={startingSubject !== null}
        >
          {startingSubject ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startBtnText}>
              🚀 Bắt đầu thi — {SUBJECT_CATALOG.find((s) => s.id === selectedSubject)?.name}
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={[styles.hintCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.hintText, { color: colors.textMuted }]}>
            👆 Chọn môn học ở trên để bắt đầu bài thi
          </Text>
        </View>
      )}

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>📋 Thông tin thi</Text>
        <Text style={[styles.infoText, { color: colors.textMuted }]}>• Đề thi ngẫu nhiên từ ngân hàng câu hỏi</Text>
        <Text style={[styles.infoText, { color: colors.textMuted }]}>• Thời gian: 45 phút</Text>
        <Text style={[styles.infoText, { color: colors.textMuted }]}>• Có nhiều loại câu (MCQ, Đúng/Sai, Điền chỗ trống)</Text>
        <Text style={[styles.infoText, { color: colors.textMuted }]}>• Premium: xem đáp án chi tiết sau khi nộp</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, marginBottom: 4 },
  activeCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 6 },
  resumeBtn: { marginTop: 6, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  startBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hintCard: { borderWidth: 1, borderRadius: 12, padding: 14 },
  hintText: { fontSize: 14, textAlign: 'center' },
  infoCard: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 6 },
  infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  infoText: { fontSize: 13, lineHeight: 20 },
});
