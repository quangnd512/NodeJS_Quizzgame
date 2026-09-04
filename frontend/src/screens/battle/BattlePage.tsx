import { useRef, useState, useEffect } from 'react';
import { createBattleSocket } from '../../lib/battleSocket.js';
import type {
  BattleSocket,
  BattleQueueStatusPayload,
  BattleMatchEndedPayload,
  BattleMatchFoundPayload,
} from '../../lib/battleSocket.js';
import { getBattleConfig, getMyProfile, ApiError } from '../../lib/api.js';
import type {
  UserProfile,
  BattleConfig,
  ActiveBattleMatchSnapshot,
  BattleHistoryItem,
} from '../../lib/api.js';
import { SUBJECTS_MAP } from '../../lib/constants.js';
import Spinner from '../../components/Spinner.js';
import { OPTION_LABELS } from '../practice/practiceConstants.js';
import {
  BATTLE_ACTIVE_MATCH_KEY,
  BATTLE_QUEUE_CRITERIA_LABEL,
} from './battleConstants.js';

// Mirrors App.tsx — BattleResumeState phải ở đây vì BattlePage nhận nó qua props;
// App.tsx giữ bản gốc, file này giữ bản cục bộ để tránh circular import.
type BattleResumeState =
  | { kind: 'live'; snapshot: ActiveBattleMatchSnapshot }
  | { kind: 'ended'; item: BattleHistoryItem; currentPoints: number };

type BattlePhase = 'setup' | 'queue' | 'play' | 'result';

// BATTLE_RESULT_LABEL cục bộ — 5 kết quả trận (khác với BATTLE_HISTORY_RESULT_LABEL
// chỉ có 3 BattleResult; ở đây dùng BattleMatchEndedPayload['result']).
const BATTLE_RESULT_LABEL: Record<BattleMatchEndedPayload['result'], { text: string; icon: string; cls: string }> = {
  WIN: { text: 'Chiến thắng!', icon: '🏆', cls: 'battle-result-win' },
  LOSE: { text: 'Thua cuộc', icon: '😢', cls: 'battle-result-lose' },
  DRAW: { text: 'Hoà', icon: '🤝', cls: 'battle-result-draw' },
  OPPONENT_LEFT_WIN: { text: 'Thắng — đối thủ mất kết nối', icon: '🏳️', cls: 'battle-result-win' },
  CANCELLED_BOTH_LEFT: { text: 'Trận đấu bị huỷ', icon: '⚠️', cls: 'battle-result-draw' },
};

interface BattleQuestionState {
  index: number;
  text: string;
  options: [string, string, string, string];
  receivedAt: number;
  selected: number | null;
  correctOption: number | null;
  myPointsEarned: number | null;
}

function BattlePage({
  profile, sessionToken, onBack, onHistory, onProfileUpdate, onError, initialResume, onResumeClear,
}: {
  profile: UserProfile;
  sessionToken: string;
  onBack: () => void;
  onHistory: () => void;
  onProfileUpdate: (p: UserProfile) => void;
  onError: (e: unknown) => void;
  /** Fix S5: nếu khác null, đưa thẳng vào lại đúng trận đang dở (hoặc màn kết quả
   * nếu trận vừa kết thúc trong lúc rời app) thay vì luôn bắt đầu từ màn setup. */
  initialResume?: BattleResumeState | null;
  onResumeClear?: () => void;
}) {
  const socketRef = useRef<BattleSocket | null>(null);
  const [phase, setPhase] = useState<BattlePhase>(() => {
    if (initialResume?.kind === 'live') return 'play';
    if (initialResume?.kind === 'ended') return 'result';
    return 'setup';
  });
  const [socketReady, setSocketReady] = useState(false);
  const [socketError, setSocketError] = useState('');
  // Cac loi lien quan den "Vao phong bang ma" (BATTLE_CANNOT_JOIN_OWN_ROOM,
  // BATTLE_ROOM_NOT_FOUND) hien rieng bang modal (thay vi banner chung o dau
  // trang) theo yeu cau S5 - de nguoi dung KHONG bo sot, vi day deu la thao
  // tac go/dan ma de nham lan (ma sai, ma cua chinh minh...).
  const [roomErrorModal, setRoomErrorModal] = useState<{ title: string; body: string } | null>(null);

  // Cấu hình (mức cược hợp lệ + số dư điểm)
  const [config, setConfig] = useState<BattleConfig | null>(null);
  const [configError, setConfigError] = useState('');

  // Màn "vào trận" (TASK 11) — chỉ mặc định vào môn học viên ĐÃ chọn ở trang cá
  // nhân (profile.subjects); KHÔNG fallback sang SUBJECTS[0] toàn cục, vì môn
  // đó có thể không nằm trong danh sách môn học viên đang ôn.
  const defaultSubject = profile.subjects[0]?.id ?? '';
  const [subject, setSubject] = useState(defaultSubject);
  const [stake, setStake] = useState<number | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);

  // Màn "chờ ghép trận" (TASK 12)
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [criteria, setCriteria] = useState<BattleQueueStatusPayload['currentCriteria']>('STRICT');
  const [myRoomCode, setMyRoomCode] = useState<string | null>(null);

  // Màn "thi đấu" (TASK 13) — khởi tạo optimistic từ initialResume (Fix S5) nếu có,
  // sẽ được dữ liệu THẬT từ server ghi đè gần như ngay lập tức qua socket (reconnect
  // tự resend câu hỏi/điểm số) - chỉ để tránh "nháy" màn hình trống/0 điểm lúc đầu.
  const [match, setMatch] = useState<BattleMatchFoundPayload | null>(() => {
    if (initialResume?.kind === 'live') {
      const s = initialResume.snapshot;
      return { matchId: s.matchId, subject: s.subject, stake: s.stake, opponentName: s.opponentName, isBotMatch: s.isBotMatch };
    }
    if (initialResume?.kind === 'ended') {
      const it = initialResume.item;
      return { matchId: it.id, subject: it.subject, stake: it.stake, opponentName: it.opponentName ?? 'Người chơi', isBotMatch: it.isBotMatch };
    }
    return null;
  });
  const [question, setQuestion] = useState<BattleQuestionState | null>(() => {
    const q = initialResume?.kind === 'live' ? initialResume.snapshot.question : null;
    if (!q) return null;
    return {
      index: q.questionIndex, text: q.questionText, options: q.options,
      receivedAt: Date.now(), selected: null, correctOption: null, myPointsEarned: null,
    };
  });
  const [myScore, setMyScore] = useState(() => {
    if (initialResume?.kind === 'live') return initialResume.snapshot.myScore;
    if (initialResume?.kind === 'ended') return initialResume.item.myScore;
    return 0;
  });
  const [opponentScore, setOpponentScore] = useState(() => {
    if (initialResume?.kind === 'live') return initialResume.snapshot.opponentScore;
    if (initialResume?.kind === 'ended') return initialResume.item.opponentScore;
    return 0;
  });
  const [opponentDisconnected, setOpponentDisconnected] = useState(
    () => initialResume?.kind === 'live' && initialResume.snapshot.opponentDisconnected,
  );
  // Dem nguoc so giay con lai cua grace period mat ket noi - fix S5: truoc day banner
  // chi hien text tinh "cho toi da 30 giay", KHONG co dong ho dem nguoc thuc, khien
  // nguoi choi khong biet dang o giay thu may -> cam giac "dung hinh" du server da
  // xu ly tuc thi (da do bang timestamp, do tre server = 0ms).
  const [disconnectSecondsLeft, setDisconnectSecondsLeft] = useState(
    () => (initialResume?.kind === 'live' && initialResume.snapshot.opponentDisconnected ? 30 : 0),
  );
  const [timeLeft, setTimeLeft] = useState(
    () => (initialResume?.kind === 'live' ? initialResume.snapshot.question?.secondsLeft ?? 20 : 20),
  );

  // Màn "kết quả" (TASK 14)
  const [result, setResult] = useState<BattleMatchEndedPayload | null>(() => {
    if (initialResume?.kind !== 'ended') return null;
    const it = initialResume.item;
    return {
      result: it.result, myScore: it.myScore, opponentScore: it.opponentScore,
      pointsChange: it.pointsChange, newBalance: initialResume.currentPoints,
    };
  });

  // Fix S5: tieu thu `initialResume` DUY NHAT 1 LAN luc mount - bao App() xoa state
  // nay di de lan sau vao lai man Battle (VD bam "Chơi lại"/"Về trang chủ" roi vao
  // lai) KHONG bi ap dung lai gia tri cu.
  useEffect(() => {
    if (initialResume) onResumeClear?.();
    // Dam bao marker localStorage van dung (phong truong hop bi mat vi ly do nao do)
    // khi vao lai dung 1 tran con song.
    if (initialResume?.kind === 'live') {
      localStorage.setItem(BATTLE_ACTIVE_MATCH_KEY, initialResume.snapshot.matchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tải cấu hình (mức cược + số dư điểm) — REST, KHÔNG qua socket
  useEffect(() => {
    let cancelled = false;
    void getBattleConfig(sessionToken)
      .then((cfg) => {
        if (cancelled) return;
        setConfig(cfg);
        setStake((s) => s ?? cfg.stakes[0] ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setConfigError(err instanceof Error ? err.message : 'Không tải được cấu hình thi đấu.');
        // Loi 401 (phien het han) can duoc App() xu ly tap trung (dang xuat + bao loi toan cuc);
        // cac loi khac (vd. mat mang tam thoi) chi hien banner cuc bo o tren, khong lam gian doan man hinh.
        if (err instanceof ApiError && err.status === 401) onError(err);
      });
    return () => { cancelled = true; };
  }, [sessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kết nối Socket.io 1 LẦN DUY NHẤT khi component mount, ngắt khi unmount
  // (rời màn hình Thi đấu = coi như "mất kết nối" phía backend, xử lý đúng
  // như 1 lần disconnect bình thường — không cần logic đặc biệt gì thêm).
  useEffect(() => {
    const socket = createBattleSocket(sessionToken);
    socketRef.current = socket;

    socket.on('connect', () => { setSocketReady(true); setSocketError(''); });
    socket.on('disconnect', () => { setSocketReady(false); });
    socket.on('connect_error', (err: Error) => {
      setSocketReady(false);
      setSocketError(err.message || 'Không thể kết nối máy chủ thi đấu.');
    });

    socket.on('battle:queue-status', (payload) => {
      setWaitingSeconds(payload.waitingSeconds);
      setCriteria(payload.currentCriteria);
      setSetupBusy(false);
      setPhase((p) => (p === 'setup' ? 'queue' : p));
    });

    socket.on('battle:room-created', (payload) => {
      setMyRoomCode(payload.roomCode);
      setSetupBusy(false);
      setPhase('queue');
    });

    socket.on('battle:match-found', (payload) => {
      setMatch(payload);
      setMyScore(0);
      setOpponentScore(0);
      setOpponentDisconnected(false);
      setDisconnectSecondsLeft(0);
      setMyRoomCode(null);
      setQuestion(null);
      setSetupBusy(false);
      setPhase('play');
      // Fix S5: nhớ matchId đang chơi để phát hiện "trận vừa kết thúc trong lúc
      // rời app" nếu tải lại trang mà không còn thấy trận này "sống" nữa.
      localStorage.setItem(BATTLE_ACTIVE_MATCH_KEY, payload.matchId);
    });

    socket.on('battle:question', (payload) => {
      setQuestion({
        index: payload.questionIndex,
        text: payload.questionText,
        options: payload.options,
        receivedAt: Date.now(),
        selected: null,
        correctOption: null,
        myPointsEarned: null,
      });
      setTimeLeft(20);
      setOpponentDisconnected(false);
      setDisconnectSecondsLeft(0);
    });

    socket.on('battle:opponent-progress', (payload) => {
      setOpponentScore(payload.opponentScore);
      // Fix S5: day la bang chung doi thu dang HOAT DONG (vua tra loi CAU HIEN TAI,
      // HOAC vua ket noi lai - ca 2 truong hop server deu ban su kien nay ngay lap
      // tuc). Truoc day banner "doi thu mat ket noi" CHI tat khi co CAU HOI MOI, nen
      // neu doi thu ket noi lai nhung chua kip tra loi/cau hoi chua doi, nguoi con lai
      // van thay banner "dung hinh" du doi thu da quay lai that.
      setOpponentDisconnected(false);
      setDisconnectSecondsLeft(0);
    });

    socket.on('battle:question-result', (payload) => {
      setMyScore(payload.myTotalScore);
      setQuestion((q) => (q && q.index === payload.questionIndex
        ? { ...q, correctOption: payload.correctOption, myPointsEarned: payload.myPointsEarned }
        : q));
    });

    socket.on('battle:opponent-disconnected', (payload) => {
      setOpponentDisconnected(true);
      // Fix S5: dong ho dem nguoc THAT (khop dung gracePeriodSeconds server gui ve,
      // hien tai luon la 30) - truoc day banner chi ghi tinh "cho toi da 30 giay",
      // khong ro dang o giay thu may, de gay cam giac "dung hinh"/cho qua lau du
      // server xu ly tuc thi (da do bang timestamp: do tre server = 0ms).
      setDisconnectSecondsLeft(payload.gracePeriodSeconds);
    });

    socket.on('battle:match-ended', (payload) => {
      setResult(payload);
      setPhase('result');
      // Lam moi profile.points (hien thi o trang ca nhan) - bo sung fix S5:
      // BattlePage truoc day KHONG lam viec nay (khac PracticePage/ExamPage
      // da co san onProfileUpdate), khien "Số dư điểm" o trang ca nhan hien
      // SAI (van la so du TRUOC tran) sau khi thang/thua PvP.
      void getMyProfile(sessionToken).then(onProfileUpdate).catch(() => { /* bo qua, khong chan UI */ });
      // Tran da ket thuc binh thuong (khong phai do rời app) - xoa marker resume,
      // khong con gi de "vua ket thuc trong luc roi app" nua.
      localStorage.removeItem(BATTLE_ACTIVE_MATCH_KEY);
    });

    socket.on('battle:error', (payload) => {
      setSetupBusy(false);
      if (payload.code === 'BATTLE_CANNOT_JOIN_OWN_ROOM') {
        setRoomErrorModal({
          title: 'Không thể vào phòng của chính bạn',
          body: 'Mã này do chính bạn tạo ra — hãy gửi mã cho bạn bè để họ nhập, bạn không thể tự vào phòng của mình.',
        });
      } else if (payload.code === 'BATTLE_ROOM_NOT_FOUND') {
        setRoomErrorModal({
          title: 'Không tìm thấy phòng',
          body: 'Mã phòng này không tồn tại, đã bị huỷ, hoặc người tạo phòng đã mất kết nối. Kiểm tra lại mã hoặc nhờ bạn bè tạo phòng mới.',
        });
      } else {
        setSocketError(payload.message);
      }
    });

    socket.connect();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Đếm ngược 20s cục bộ cho câu hiện tại — CHỈ để hiển thị, server tự quyết định
  // khi hết giờ thật (dùng thời gian server, xem battle.engine.service.ts).
  useEffect(() => {
    if (phase !== 'play' || !question || question.selected !== null) return;
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, question?.index, question?.selected]);

  // Dem nguoc so giay con lai khi doi thu mat ket noi - CHI de hien thi (server tu
  // quyet dinh xu thang ky thuat sau dung 30s that, xem BATTLE_DISCONNECT_GRACE_MS).
  useEffect(() => {
    if (!opponentDisconnected || disconnectSecondsLeft <= 0) return;
    const id = setInterval(() => {
      setDisconnectSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [opponentDisconnected, disconnectSecondsLeft]);

  function handleFindMatch() {
    if (!stake || !socketReady) return;
    setSocketError('');
    setSetupBusy(true);
    socketRef.current?.emit('battle:join-queue', { subject, stake });
  }

  function handleCreateRoom() {
    if (!stake || !socketReady) return;
    setSocketError('');
    setSetupBusy(true);
    socketRef.current?.emit('battle:create-room', { subject, stake });
  }

  function handleJoinRoom() {
    const code = roomCodeInput.trim().toUpperCase();
    if (!code || !socketReady) return;
    setSocketError('');
    setSetupBusy(true);
    socketRef.current?.emit('battle:join-room', { roomCode: code });
  }

  function handleCancelQueue() {
    // Luon bao server huy — dung cho ca 2 truong hop "dang trong hang doi thuong" LAN
    // "dang cho ban be vao phong rieng vua tao" (server tu xu ly ca 2, xem
    // handleCancelQueue trong battle.engine.service.ts). Truoc day chi emit khi KHONG
    // co myRoomCode -> bam "Huy" luc dang cho phong rieng khong xoa phong tren server,
    // de lai phong "mo coi" van co the bi nguoi khac vao va tru diem ngoai y muon.
    socketRef.current?.emit('battle:cancel-queue');
    setPhase('setup');
    setMyRoomCode(null);
    setSetupBusy(false);
  }

  function handleSelectOption(idx: number) {
    if (!question || question.selected !== null || !match) return;
    const clientTimeMs = Date.now() - question.receivedAt;
    setQuestion((q) => (q ? { ...q, selected: idx } : q));
    socketRef.current?.emit('battle:submit-answer', {
      matchId: match.matchId,
      questionIndex: question.index,
      selectedOption: idx,
      clientTimeMs,
    });
  }

  function handlePlayAgain() {
    setPhase('setup');
    setMatch(null);
    setQuestion(null);
    setResult(null);
    setMyScore(0);
    setOpponentScore(0);
    // Làm mới số dư điểm hiển thị ở màn vào trận sau khi vừa cược/thắng/thua.
    void getBattleConfig(sessionToken).then(setConfig).catch(() => { /* bỏ qua, không chặn UI */ });
  }

  return (
    <div className="screen screen-battle">
      <div className="page-header">
        <button className="btn-back" onClick={onBack}>← Quay lại</button>
        <h2 className="page-title" style={{ flex: 1 }}>⚔️ Thi đấu đối kháng</h2>
        {phase === 'setup' && (
          <button className="btn-link" onClick={onHistory}>Lịch sử</button>
        )}
      </div>

      {socketError && (
        <div className="report-error" style={{ margin: '0 1.25rem .5rem' }} onClick={() => setSocketError('')}>
          ⚠️ {socketError}
        </div>
      )}

      {roomErrorModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setRoomErrorModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 className="modal-title">{roomErrorModal.title}</h3>
            <p className="modal-body">{roomErrorModal.body}</p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setRoomErrorModal(null)}>Đã hiểu</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'setup' && (
        <BattleSetupPhase
          subjects={profile.subjects}
          subject={subject}
          onSubjectChange={setSubject}
          stake={stake}
          onStakeChange={setStake}
          config={config}
          configError={configError}
          roomCodeInput={roomCodeInput}
          onRoomCodeInputChange={setRoomCodeInput}
          busy={setupBusy}
          socketReady={socketReady}
          onFindMatch={handleFindMatch}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {phase === 'queue' && (
        <BattleQueuePhase
          waitingSeconds={waitingSeconds}
          criteria={criteria}
          myRoomCode={myRoomCode}
          onCancel={handleCancelQueue}
        />
      )}

      {phase === 'play' && match && (
        <BattlePlayPhase
          match={match}
          question={question}
          myScore={myScore}
          opponentScore={opponentScore}
          opponentDisconnected={opponentDisconnected}
          disconnectSecondsLeft={disconnectSecondsLeft}
          timeLeft={timeLeft}
          onSelectOption={handleSelectOption}
        />
      )}

      {phase === 'result' && result && (
        <BattleResultPhase
          result={result}
          match={match}
          onPlayAgain={handlePlayAgain}
          onBack={onBack}
        />
      )}
    </div>
  );
}

// ─── BattleSetupPhase (TASK 11 — màn hình vào trận) ─────────────────────────

function BattleSetupPhase({
  subjects, subject, onSubjectChange, stake, onStakeChange, config, configError,
  roomCodeInput, onRoomCodeInputChange, busy, socketReady, onFindMatch, onCreateRoom, onJoinRoom,
}: {
  subjects: { id: string; name: string }[];
  subject: string;
  onSubjectChange: (id: string) => void;
  stake: number | null;
  onStakeChange: (v: number) => void;
  config: BattleConfig | null;
  configError: string;
  roomCodeInput: string;
  onRoomCodeInputChange: (v: string) => void;
  busy: boolean;
  socketReady: boolean;
  onFindMatch: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}) {
  const notEnoughPoints = !!(config && stake && config.currentPoints < stake);
  const noSubjectChosen = subjects.length === 0;

  return (
    <div>
      {config && (
        <div className="points-card">
          <span className="pts-label">Số dư điểm</span>
          <span className="pts-num">{config.currentPoints.toLocaleString('vi-VN')}</span>
          <span className="pts-unit">điểm</span>
        </div>
      )}
      {configError && <p className="report-error" style={{ margin: '0 1.25rem' }}>{configError}</p>}

      <section className="card-section">
        <h3 className="section-title">Chọn môn thi đấu</h3>
        {noSubjectChosen ? (
          <p className="empty">
            Bạn chưa chọn môn học nào ở trang cá nhân — vào "Đổi môn" để chọn môn trước khi thi đấu.
          </p>
        ) : (
          <div className="practice-subjects">
            {subjects.map((s) => {
              const info = SUBJECTS_MAP[s.id] ?? { name: s.name, emoji: '📘' };
              return (
                <button
                  key={s.id}
                  className="practice-subject-card"
                  style={subject === s.id ? { borderColor: 'var(--accent,#4f8ef7)', borderWidth: 2 } : undefined}
                  onClick={() => onSubjectChange(s.id)}
                >
                  <span className="ps-emoji">{info.emoji}</span>
                  <div className="ps-info"><span className="ps-name">{info.name}</span></div>
                  {subject === s.id && <span className="ps-arrow">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card-section">
        <h3 className="section-title">Chọn mức cược</h3>
        <div className="chips">
          {(config?.stakes ?? []).map((s) => (
            <button
              key={s}
              className="chip"
              style={stake === s
                ? { background: 'var(--accent,#4f8ef7)', color: '#fff', cursor: 'pointer', border: 'none' }
                : { cursor: 'pointer' }}
              onClick={() => onStakeChange(s)}
            >
              {s.toLocaleString('vi-VN')} điểm
            </button>
          ))}
        </div>
        {notEnoughPoints && (
          <p className="report-error" style={{ marginTop: '.5rem' }}>
            Bạn không đủ điểm để cược mức này.
          </p>
        )}
      </section>

      <div style={{ padding: '0 1.25rem .75rem', display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
        <button
          className="btn-primary btn-lg"
          disabled={busy || !socketReady || !stake || notEnoughPoints || noSubjectChosen}
          onClick={onFindMatch}
        >
          {busy ? <Spinner /> : null} Tìm trận 🔍
        </button>
        <button
          className="btn-secondary btn-lg"
          disabled={busy || !socketReady || !stake || notEnoughPoints || noSubjectChosen}
          onClick={onCreateRoom}
        >
          Tạo phòng mời bạn 👥
        </button>
      </div>

      <section className="card-section">
        <h3 className="section-title">Vào phòng bằng mã</h3>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <input
            className="field-input"
            placeholder="Nhập mã 6 ký tự"
            value={roomCodeInput}
            maxLength={6}
            onChange={(e) => onRoomCodeInputChange(e.target.value.toUpperCase())}
            style={{ flex: 1, textTransform: 'uppercase' }}
          />
          <button
            className="btn-secondary"
            disabled={busy || !socketReady || roomCodeInput.trim().length === 0}
            onClick={onJoinRoom}
          >
            Vào phòng
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── BattleQueuePhase (TASK 12 — màn hình chờ ghép trận) ────────────────────

function BattleQueuePhase({
  waitingSeconds, criteria, myRoomCode, onCancel,
}: {
  waitingSeconds: number;
  criteria: BattleQueueStatusPayload['currentCriteria'];
  myRoomCode: string | null;
  onCancel: () => void;
}) {
  return (
    <div className="screen-center" style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
      <div className="loader-ring" />
      {myRoomCode ? (
        <>
          <p style={{ margin: '1rem 0 .25rem', fontWeight: 600 }}>Đang chờ bạn bè vào phòng…</p>
          <p style={{ fontSize: '2rem', letterSpacing: '.3em', fontWeight: 700, margin: '.5rem 0' }}>
            {myRoomCode}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
            Gửi mã này cho bạn bè để vào thẳng trận, không qua hàng đợi.
          </p>
        </>
      ) : (
        <>
          <p style={{ margin: '1rem 0 .25rem', fontWeight: 600 }}>Đang tìm đối thủ… {waitingSeconds}s</p>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>{BATTLE_QUEUE_CRITERIA_LABEL[criteria]}</p>
          {/* An hoan toan danh tinh bot khoi nguoi choi (quyet dinh san pham) - KHONG con
              bao truoc "se ghep voi may" sau 30s, tranh lo thong tin truoc khi vao tran. */}
          <p style={{ color: 'var(--muted)', fontSize: '.78rem', marginTop: '.5rem' }}>
            Hệ thống sẽ tự động tìm đối thủ phù hợp nhất cho bạn.
          </p>
        </>
      )}
      <button className="btn-secondary" style={{ marginTop: '1.5rem' }} onClick={onCancel}>
        Huỷ tìm trận
      </button>
    </div>
  );
}

// ─── BattlePlayPhase (TASK 13 — màn hình thi đấu realtime) ──────────────────

function BattlePlayPhase({
  match, question, myScore, opponentScore, opponentDisconnected, disconnectSecondsLeft, timeLeft, onSelectOption,
}: {
  match: BattleMatchFoundPayload;
  question: BattleQuestionState | null;
  myScore: number;
  opponentScore: number;
  opponentDisconnected: boolean;
  disconnectSecondsLeft: number;
  timeLeft: number;
  onSelectOption: (idx: number) => void;
}) {
  return (
    <div className="practice-session">
      <div className="ps-topbar">
        <span className="ps-progress-text">
          {question ? `Câu ${question.index + 1}/10` : 'Đang chuẩn bị…'}
        </span>
        <span className={`ps-timer ${timeLeft <= 5 ? 'danger' : ''}`}>{timeLeft}s</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '.5rem 1.25rem', fontSize: '.9rem' }}>
        <span>🙂 Bạn: <strong>{myScore}</strong></span>
        {/* An hoan toan danh tinh bot khoi nguoi choi (quyet dinh san pham) - LUON hien
            icon nguoi that, KHONG con phan biet theo match.isBotMatch nua. */}
        <span>🧑 {match.opponentName}: <strong>{opponentScore}</strong></span>
      </div>

      {opponentDisconnected && (
        <div className="report-error" style={{ margin: '0 1.25rem .5rem' }}>
          {/* Fix S5: dong ho dem nguoc THAT thay vi text tinh "cho toi da 30 giay" -
              giup nguoi choi biet ro dang o giay thu may, tranh cam giac "dung hinh".
              Khi ve 0 (dong ho client co the lech vai tram ms so voi server) - BO SO,
              khong hien "cho 0s" (doc vo nghia). KHONG lap lai/reset 30s moi vi server
              CHI co DUNG 1 lan 30 giay that (BATTLE_DISCONNECT_GRACE_MS) - het thoi
              gian nay server tu xu thang/huy tran, khong gia han them. */}
          ⚠️ Đối thủ mất kết nối
          {disconnectSecondsLeft > 0 ? `, đang chờ ${disconnectSecondsLeft}s để họ quay lại…` : ', đang xử lý…'}
        </div>
      )}

      {!question ? (
        <div className="screen-center" style={{ padding: '2rem' }}><Spinner /></div>
      ) : (
        <>
          <div className="ps-question">{question.text}</div>
          <div className="ps-options">
            {question.options.map((opt, idx) => {
              let cls = 'ps-option';
              if (question.correctOption !== null) {
                if (idx === question.correctOption) cls += ' correct';
                else if (idx === question.selected) cls += ' wrong';
                else cls += ' dimmed';
              } else if (idx === question.selected) {
                cls += ' dimmed';
              }
              return (
                <button
                  key={idx}
                  className={cls}
                  disabled={question.selected !== null}
                  onClick={() => onSelectOption(idx)}
                >
                  <span className="opt-label">{OPTION_LABELS[idx]}</span>
                  <span className="opt-text">{opt}</span>
                </button>
              );
            })}
          </div>
          {question.myPointsEarned !== null && (
            <p style={{ textAlign: 'center', fontWeight: 600 }}>
              +{question.myPointsEarned} điểm
            </p>
          )}
          {/* Sua theo yeu cau S5: TRUOC day thong bao "dang cho doi thu" bien mat NGAY
              khi minh nhan duoc ket qua cham diem cua CHINH MINH (correctOption khac
              null) - nhung cau hoi CHUA CHAC da chuyen tiep, vi server van cho doi thu
              tra loi (hoac het gio) roi moi advance. Gap nay khien man hinh nhu "dung
              hinh" khong ro ly do. Gio hien thong bao LIEN TUC tu luc chon dap an cho
              toi khi cau hoi thuc su chuyen (question.selected reset ve null). */}
          {question.selected !== null && (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '.85rem' }}>
              {question.correctOption === null
                ? 'Đã gửi đáp án, đang chấm điểm…'
                : 'Đang chờ đối thủ trả lời câu này…'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── BattleResultPhase (TASK 14 — màn hình kết quả) ──────────────────────────

function BattleResultPhase({
  result, match, onPlayAgain, onBack,
}: {
  result: BattleMatchEndedPayload;
  match: BattleMatchFoundPayload | null;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  const label = BATTLE_RESULT_LABEL[result.result];
  return (
    <div className="screen-center" style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
      <p style={{ fontSize: '3rem', margin: 0 }}>{label.icon}</p>
      <h2 className={label.cls} style={{ margin: '.5rem 0' }}>{label.text}</h2>
      <p style={{ color: 'var(--muted)' }}>
        {match ? `${match.subject} · Cược ${match.stake.toLocaleString('vi-VN')} điểm` : ''}
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', margin: '1.25rem 0' }}>
        <div>
          <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Điểm của bạn</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.myScore}</div>
        </div>
        <div>
          <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Điểm đối thủ</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.opponentScore}</div>
        </div>
      </div>

      <p style={{ fontSize: '1.1rem', fontWeight: 600, color: result.pointsChange >= 0 ? 'var(--success,#22a06b)' : 'var(--color-error,#e53)' }}>
        {result.pointsChange >= 0 ? '+' : ''}{result.pointsChange.toLocaleString('vi-VN')} điểm
      </p>
      <p style={{ color: 'var(--muted)' }}>Số dư mới: {result.newBalance.toLocaleString('vi-VN')} điểm</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '.625rem', marginTop: '1.5rem' }}>
        <button className="btn-primary btn-lg" onClick={onPlayAgain}>Chơi lại</button>
        <button className="btn-secondary btn-lg" onClick={onBack}>Về trang chủ</button>
      </div>
    </div>
  );
}

export default BattlePage;
export type { BattleResumeState };
