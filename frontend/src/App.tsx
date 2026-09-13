import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { firebaseAuth } from './lib/firebase.js';
import {
  loginWithFirebaseToken, getMyProfile, ApiError,
  getActiveExamSession, abandonExam,
  getActiveBattleMatch, getBattleHistory, getBattleConfig,
  getUnreadCount, getNotifications,
} from './lib/api.js';
import type {
  UserProfile, ActiveExamSession as ActiveExamSessionInfo,
  NotificationItem,
  BattleHistoryItem, ActiveBattleMatchSnapshot,
} from './lib/api.js';
import './App.css';
import LoadingScreen from './screens/LoadingScreen.js';
import LoginPage from './screens/LoginPage.js';
import OnboardingPage from './screens/OnboardingPage.js';
import AdGatePage from './screens/AdGatePage.js';
import ProfilePage from './screens/ProfilePage.js';
import type { ThemeMode } from './screens/ProfilePage.js';
import PracticePage from './screens/practice/PracticePage.js';
import ExamPage from './screens/exam/ExamPage.js';
import LeaderboardPage from './screens/LeaderboardPage.js';
import ProgressPage from './screens/ProgressPage.js';
import WrongAnswersPage from './screens/WrongAnswersPage.js';
import SubmissionsPage from './screens/SubmissionsPage.js';
import BattlePage from './screens/battle/BattlePage.js';
import BattleHistoryPage from './screens/battle/BattleHistoryPage.js';
import AdminPage from './screens/admin/AdminPage.js';
import DevLoginPage from './screens/DevLoginPage.js';
import NotificationPanel, { NotificationToast } from './components/NotificationPanel.js';
import { clearDraftAnswers } from './screens/exam/examUtils.js';
import { BATTLE_ACTIVE_MATCH_KEY } from './screens/battle/battleConstants.js';

type Screen = 'loading' | 'login' | 'devLogin' | 'onboarding' | 'adGate' | 'profile' | 'practice' | 'exam' | 'admin' | 'leaderboard' | 'progress' | 'wrongAnswers' | 'submissions' | 'battle' | 'battleHistory';

/** Trạng thái khôi phục trận Thi đấu đối kháng sau khi tải lại trang/đăng nhập lại (Fix S5). */
type BattleResumeState =
  | { kind: 'live'; snapshot: ActiveBattleMatchSnapshot }
  | { kind: 'ended'; item: BattleHistoryItem; currentPoints: number };

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen]             = useState<Screen>(() => {
    if (window.location.hash === '#admin') return 'admin';
    // Dev-login page: chỉ hiện khi DEV mode và URL có ?devLogin=1
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('devLogin') === '1') return 'devLogin';
    return 'loading';
  });
  const [sessionToken, setSessionToken] = useState('');
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [globalError, setGlobalError]   = useState('');
  // Bài thi đang dở — kiểm tra ngay sau khi đăng nhập để hiển thị ngay trên ProfilePage
  const [resumeAlert, setResumeAlert]   = useState<ActiveExamSessionInfo | null>(null);
  // Trận Thi đấu đối kháng đang dở (Fix S5) — kiểm tra ngay sau khi đăng nhập, TỰ ĐỘNG
  // đưa thẳng vào lại trận (khác bài thi chỉ hiện banner hỏi) vì Battle realtime nhạy
  // thời gian hơn. 'live' = trận còn đang diễn ra (còn giờ) -> vào lại màn thi đấu;
  // 'ended' = trận đã kết thúc trong lúc rời app -> hiện thẳng màn kết quả.
  const [battleResume, setBattleResume] = useState<BattleResumeState | null>(null);
  // Thông báo
  const [unreadCount, setUnreadCount]   = useState(0);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [toast, setToast]               = useState<NotificationItem | null>(null);
  // -1 = chưa poll lần nào → lần đầu poll không hiện toast (tránh spam khi mới vào app)
  const prevUnreadRef                   = useRef(-1);

  // ─── Chế độ giao diện (Sáng / Tối / Theo hệ thống) ─────────────────────────
  // ThemeMode được export từ ProfilePage.tsx — tránh duplicate definition
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('quizz_theme') as ThemeMode | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch { /* localStorage blocked (private mode) → bỏ qua */ }
    return 'system';
  });

  // Chỉ thao tác DOM + localStorage — KHÔNG gọi setState (dùng trong useEffect)
  function applyThemeToDom(mode: ThemeMode) {
    const hour = new Date().getHours();
    const effective = mode === 'system'
      ? (hour >= 5 && hour < 18 ? 'light' : 'dark')
      : mode;
    document.documentElement.setAttribute('data-theme', effective);
    try { localStorage.setItem('quizz_theme', mode); } catch { /* bỏ qua */ }
  }

  // Handler dùng ở UI: cập nhật state + DOM
  function applyTheme(mode: ThemeMode) {
    applyThemeToDom(mode);
    setThemeMode(mode);
  }

  // Khởi tạo theme khi mount và mỗi khi themeMode thay đổi
  useEffect(() => {
    applyThemeToDom(themeMode);
    // Nếu 'system', cập nhật lại mỗi phút để phát hiện khi qua 5h/18h
    if (themeMode !== 'system') return undefined;
    const id = setInterval(() => applyThemeToDom('system'), 60_000);
    return () => clearInterval(id);
  }, [themeMode]);

  useEffect(() => {
    // Trang Admin + DevLogin chay doc lap, khong can dang nhap Firebase
    if (screen === 'admin' || screen === 'devLogin') return;
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setScreen('login');
        setSessionToken('');
        setProfile(null);
        setResumeAlert(null);
        setBattleResume(null);
        setUnreadCount(0);
        prevUnreadRef.current = -1;
        return;
      }
      setScreen('loading');
      try {
        const idToken = await user.getIdToken();
        const result  = await loginWithFirebaseToken(idToken);
        setSessionToken(result.token);
        if (result.isNewUser) {
          setScreen('onboarding');
        } else {
          const me = await getMyProfile(result.token);
          setProfile(me);
          // Kiểm tra bài thi đang dở ngay sau khi đăng nhập
          // để hiển thị thông báo ngay trên ProfilePage (không cần vào trang thi trước)
          const { session: active } = await getActiveExamSession(result.token).catch(() => ({ session: null }));
          if (active) setResumeAlert(active);

          // Fix S5: kiểm tra trận Thi đấu đối kháng đang dở — KHÁC bài thi (tự động
          // vào thẳng lại trận, không chỉ hiện banner hỏi), vì Battle realtime nhạy
          // thời gian hơn nhiều so với bài thi (câu hỏi tự hết giờ sau 20s).
          const battleCheck = await getActiveBattleMatch(result.token).catch(() => ({ active: false, match: null }));
          if (battleCheck.active && battleCheck.match) {
            setBattleResume({ kind: 'live', snapshot: battleCheck.match });
            setScreen('battle');
            return;
          }
          // Không còn trận nào đang sống trên backend — kiểm tra xem có phải trận
          // VỪA kết thúc trong lúc mình rời app không (nhớ qua localStorage từ lần
          // chơi trước), để hiện thẳng màn kết quả thay vì im lặng bỏ qua.
          const rememberedMatchId = localStorage.getItem(BATTLE_ACTIVE_MATCH_KEY);
          if (rememberedMatchId) {
            localStorage.removeItem(BATTLE_ACTIVE_MATCH_KEY);
            try {
              const [hist, cfg] = await Promise.all([
                getBattleHistory(result.token, 20, 0),
                getBattleConfig(result.token),
              ]);
              const item = hist.items.find((it) => it.id === rememberedMatchId);
              if (item) {
                setBattleResume({ kind: 'ended', item, currentPoints: cfg.currentPoints });
                setScreen('battle');
                return;
              }
            } catch { /* bỏ qua — không chặn luồng đăng nhập bình thường */ }
          }

          setScreen('profile');
        }
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Lỗi không xác định');
        setScreen('login');
      }
    });
    return unsub;
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Polling thông báo mỗi 30 giây — chỉ chạy khi đã đăng nhập
  useEffect(() => {
    if (!sessionToken) return;

    const poll = async () => {
      try {
        const { count } = await getUnreadCount(sessionToken);
        setUnreadCount(count);

        // Nếu có thông báo mới (count tăng so với lần poll trước, và đây không phải lần poll đầu)
        if (count > prevUnreadRef.current && prevUnreadRef.current !== -1) {
          const result = await getNotifications(sessionToken, 1, 1);
          const newest = result.notifications[0];
          if (newest && !newest.isRead) {
            setToast(newest);
            // So sanh id truoc khi tat — tranh truong hop 2 thong bao den gan nhau,
            // timeout cua thong bao CU tat mat thong bao MOI truoc han.
            // Thoi gian hien thi: 7 giay (tang tu 4 giay de de bat kip hon).
            setTimeout(() => {
              setToast((current) => (current?.id === newest.id ? null : current));
            }, 7000);
          }
        }
        prevUnreadRef.current = count;
      } catch {
        // Lỗi polling không ảnh hưởng app — bỏ qua
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 30_000);

    // Poll ngay khi tab duoc focus lai — tranh phai cho het chu ky 30s hoac
    // phai reload khi trinh duyet throttle setInterval o tab nen (VD: user
    // dang thao tac o cua so/tab khac roi quay lai tab app).
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionToken]);

  function handleApiError(err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      void signOut(firebaseAuth);
      setGlobalError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    } else {
      setGlobalError(err instanceof Error ? err.message : 'Lỗi không xác định');
    }
  }

  async function afterOnboarding() {
    try {
      const me = await getMyProfile(sessionToken);
      setProfile(me);
      setScreen('profile');
    } catch (err) { handleApiError(err); }
  }

  /**
   * Bấm "Đổi môn" từ ProfilePage — Feature 015 (Free/Premium):
   * Premium vào thẳng màn chọn môn; Free phải qua bước "xem quảng cáo" (AdGatePage) trước.
   */
  function handleChangeSubjectsClick() {
    if (profile?.isPremium) {
      setScreen('onboarding');
    } else {
      setScreen('adGate');
    }
  }

  return (
    <div className="app-shell">
      {globalError && (
        <div className="global-toast" onClick={() => setGlobalError('')}>
          <span>⚠️ {globalError}</span>
          <span className="toast-close">✕</span>
        </div>
      )}

      {/* Toast thông báo — hiện 7 giây rồi tự tắt */}
      {toast && (
        <NotificationToast
          item={toast}
          onClose={() => setToast(null)}
        />
      )}

      {/* Panel thông báo — slide-in từ trên xuống */}
      {notifOpen && (
        <NotificationPanel
          sessionToken={sessionToken}
          onClose={() => setNotifOpen(false)}
          onCountChange={setUnreadCount}
          onNavigate={(target) => {
            // Đóng panel TRƯỚC khi chuyển màn hình để tránh panel đè lên màn hình mới
            setNotifOpen(false);
            setScreen(target);
          }}
        />
      )}

      {screen === 'admin'      && <AdminPage />}
      {screen === 'loading'    && <LoadingScreen />}
      {screen === 'login'      && <LoginPage onError={(m) => setGlobalError(m)} />}
      {screen === 'devLogin' && (
        <DevLoginPage
          onSuccess={(result) => {
            setSessionToken(result.token);
            // Lấy profile đầy đủ (devLoginApi trả về không đầy đủ)
            getMyProfile(result.token)
              .then((fullProfile) => {
                setProfile(fullProfile);
                if (result.isNewUser) {
                  setScreen('onboarding');
                } else {
                  setScreen('profile');
                }
              })
              .catch((err) => {
                setGlobalError(err instanceof Error ? err.message : 'Lỗi lấy thông tin người dùng');
              });
          }}
          onError={(m) => setGlobalError(m)}
        />
      )}
      {screen === 'onboarding' && (
        <OnboardingPage
          sessionToken={sessionToken}
          currentSubjects={profile?.subjects.map((s) => s.id) ?? []}
          onDone={afterOnboarding}
          onError={handleApiError}
        />
      )}
      {screen === 'adGate' && (
        <AdGatePage
          sessionToken={sessionToken}
          onUnlocked={() => setScreen('onboarding')}
          onCancel={() => setScreen('profile')}
          onError={handleApiError}
        />
      )}
      {screen === 'profile' && profile && (
        <ProfilePage
          profile={profile}
          sessionToken={sessionToken}
          onProfileUpdate={setProfile}
          onChangeSubjects={handleChangeSubjectsClick}
          onPractice={() => setScreen('practice')}
          onExam={() => setScreen('exam')}
          onLeaderboard={() => setScreen('leaderboard')}
          onProgress={() => setScreen('progress')}
          onWrongAnswers={() => setScreen('wrongAnswers')}
          onSubmissions={() => setScreen('submissions')}
          onBattle={() => setScreen('battle')}
          onError={handleApiError}
          onLogout={() => void signOut(firebaseAuth)}
          resumeAlert={resumeAlert}
          onResumeExam={() => setScreen('exam')}
          onAbandonResume={async () => {
            if (!resumeAlert) return;
            try { await abandonExam(sessionToken, resumeAlert.id); } catch { /* bỏ qua */ }
            clearDraftAnswers(resumeAlert.id);
            localStorage.removeItem(`exam_session_data_${resumeAlert.id}`);
            setResumeAlert(null);
          }}
          unreadCount={unreadCount}
          onNotifClick={() => setNotifOpen(true)}
          themeMode={themeMode}
          onThemeChange={applyTheme}
        />
      )}
      {screen === 'practice' && profile && (
        <PracticePage
          profile={profile}
          sessionToken={sessionToken}
          onBack={() => setScreen('profile')}
          onProfileUpdate={setProfile}
          onError={handleApiError}
        />
      )}
      {screen === 'exam' && profile && (
        <ExamPage
          profile={profile}
          sessionToken={sessionToken}
          onBack={() => { setResumeAlert(null); setScreen('profile'); }}
          onProfileUpdate={setProfile}
          onError={handleApiError}
          initialResume={resumeAlert}
          onResumeClear={() => setResumeAlert(null)}
        />
      )}
      {screen === 'leaderboard' && profile && (
        <LeaderboardPage
          profile={profile}
          sessionToken={sessionToken}
          onBack={() => setScreen('profile')}
          onError={handleApiError}
        />
      )}
      {screen === 'progress' && profile && (
        <ProgressPage
          profile={profile}
          sessionToken={sessionToken}
          onBack={() => setScreen('profile')}
          onError={handleApiError}
        />
      )}
      {screen === 'wrongAnswers' && profile && (
        <WrongAnswersPage
          sessionToken={sessionToken}
          isPremium={profile.isPremium}
          onBack={() => setScreen('profile')}
          onError={handleApiError}
        />
      )}
      {screen === 'submissions' && profile && (
        <SubmissionsPage
          sessionToken={sessionToken}
          onBack={() => setScreen('profile')}
          onError={handleApiError}
        />
      )}
      {screen === 'battle' && profile && (
        <BattlePage
          profile={profile}
          sessionToken={sessionToken}
          onBack={() => setScreen('profile')}
          onHistory={() => setScreen('battleHistory')}
          onProfileUpdate={setProfile}
          onError={handleApiError}
          initialResume={battleResume}
          onResumeClear={() => setBattleResume(null)}
        />
      )}
      {screen === 'battleHistory' && profile && (
        <BattleHistoryPage
          sessionToken={sessionToken}
          onBack={() => setScreen('battle')}
          onError={handleApiError}
        />
      )}
    </div>
  );
}

