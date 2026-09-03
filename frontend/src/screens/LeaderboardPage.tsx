import { useState, useEffect } from 'react';
import { getLeaderboard, getMyLeaderboardRank } from '../lib/api.js';
import type { UserProfile, LeaderboardEntry, MyRankResponse } from '../lib/api.js';
import { SUBJECTS } from '../lib/constants.js';
import AvatarCell from '../components/AvatarCell.js';
import Spinner from '../components/Spinner.js';

const TREND_ICON: Record<string, string> = {
  up: '↑', down: '↓', same: '→', new: '—',
};
const TREND_COLOR: Record<string, string> = {
  up: '#22c55e', down: '#ef4444', same: '#94a3b8', new: '#94a3b8',
};

function LeaderboardPage({
  profile, sessionToken, onBack, onError,
}: {
  profile: UserProfile;
  sessionToken: string;
  onBack: () => void;
  onError: (e: unknown) => void;
}) {
  const [subject, setSubject]       = useState('');
  const [page, setPage]             = useState(1);
  const [entries, setEntries]       = useState<LeaderboardEntry[]>([]);
  const [total, setTotal]           = useState(0);
  const [myRank, setMyRank]         = useState<MyRankResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loadMore, setLoadMore]     = useState(false);
  const [selected, setSelected]     = useState<LeaderboardEntry | null>(null);
  async function fetchLeaderboard(p: number, subj: string, append: boolean) {
    if (p === 1) setLoading(true); else setLoadMore(true);
    try {
      const [lb, me] = await Promise.all([
        getLeaderboard(sessionToken, p, subj || undefined),
        p === 1 ? getMyLeaderboardRank(sessionToken, subj || undefined) : Promise.resolve(null),
      ]);
      if (append) {
        setEntries((prev) => [...prev, ...lb.data]);
      } else {
        setEntries(lb.data);
      }
      setTotal(lb.total);
      if (me !== null) setMyRank(me);
    } catch (err) { onError(err); }
    finally { setLoading(false); setLoadMore(false); }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    setEntries([]);
    void fetchLeaderboard(1, subject, false);
  }, [subject]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchLeaderboard(nextPage, subject, true);
  }

  const top3    = entries.slice(0, 3);
  const rest    = entries.slice(3);
  const hasMore = entries.length < total;
  // Ẩn thanh ghim khi entry của bản thân đã xuất hiện trong danh sách đã load
  const myEntryLoaded = entries.some((e) => e.userId === profile.id);

  // Podium order: [1] center top, [0] left, [2] right
  const podiumOrder = [top3[1], top3[0], top3[2]] as (LeaderboardEntry | undefined)[];
  const podiumHeight = ['52px', '80px', '36px'];

  return (
    <div className="screen" style={{ background: 'linear-gradient(160deg,#0f0c29,#302b63,#24243e)', minHeight: '100vh', color: '#fff', paddingBottom: '80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '1rem 1.25rem .5rem' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', padding: 0 }}>←</button>
        <h2 style={{ flex: 1, margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>🏆 Bảng Xếp Hạng</h2>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{ padding: '.35rem .6rem', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: '.85rem' }}
        >
          <option value="">Tất cả môn</option>
          {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><Spinner /></div>
      ) : entries.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '3rem', opacity: .6 }}>Chưa có dữ liệu xếp hạng</p>
      ) : (
        <>
          {/* ── Podium Top 3 ─────────────────────────────── */}
          {top3.length >= 1 && (
            <div style={{ padding: '1.5rem 1.25rem 1rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '1rem' }}>
              {podiumOrder.map((entry, idx) => {
                if (!entry) return <div key={idx} style={{ flex: 1 }} />;
                const isFirst = entry.rank === 1;
                const medals = ['🥈', '🥇', '🥉'];
                return (
                  <div key={entry.userId} onClick={() => setSelected(entry)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.4rem', cursor: 'pointer' }}>
                    {isFirst && (
                      <div style={{ fontSize: '1.6rem', animation: 'pulse 2s infinite' }}>👑</div>
                    )}
                    <div style={{ position: 'relative' }}>
                      <AvatarCell avatarUrl={entry.avatarUrl} name={entry.displayName} size={isFirst ? 72 : 56} />
                      <span style={{ position: 'absolute', bottom: -6, right: -6, fontSize: isFirst ? '1.4rem' : '1.1rem' }}>{medals[idx]}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '.78rem', fontWeight: 600, textAlign: 'center', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.displayName ?? 'Ẩn danh'}
                    </p>
                    <p style={{ margin: 0, fontSize: '.85rem', fontWeight: 700, color: '#fbbf24' }}>{entry.reputationScore.toFixed(1)}</p>
                    {/* Bục podium */}
                    <div style={{ width: '100%', height: podiumHeight[idx], background: isFirst ? 'linear-gradient(180deg,#f6d365,#fda085)' : 'rgba(255,255,255,.15)', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', color: isFirst ? '#333' : '#fff' }}>
                      {entry.rank}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Danh sách hạng 4+ ───────────────────────── */}
          {rest.length > 0 && (
            <div style={{ margin: '0 1rem', background: 'rgba(255,255,255,.06)', borderRadius: '16px', overflow: 'hidden' }}>
              {rest.map((entry, i) => {
                const isMe = entry.userId === profile.id;
                return (
                  <div key={entry.userId} onClick={() => setSelected(entry)} style={{
                    display: 'flex', alignItems: 'center', gap: '.75rem',
                    padding: '.7rem 1rem',
                    background: isMe ? 'rgba(251,191,36,.15)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.03)',
                    borderBottom: '1px solid rgba(255,255,255,.05)',
                    cursor: 'pointer',
                  }}>
                    <span style={{ width: '28px', textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '.9rem' }}>{entry.rank}</span>
                    <AvatarCell avatarUrl={entry.avatarUrl} name={entry.displayName} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: isMe ? 700 : 500, fontSize: '.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.displayName ?? 'Ẩn danh'}{isMe && ' (Bạn)'}
                      </p>
                      <p style={{ margin: 0, fontSize: '.75rem', color: '#94a3b8' }}>
                        TB: {entry.avgScore.toFixed(1)} · {entry.examCount} lần thi
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#fbbf24', fontSize: '.95rem' }}>{entry.reputationScore.toFixed(1)}</p>
                      <span style={{ fontSize: '1rem', color: TREND_COLOR[entry.trend] }}>{TREND_ICON[entry.trend] ?? '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Nút xem thêm */}
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                onClick={() => void handleLoadMore()}
                disabled={loadMore}
                style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', padding: '.6rem 1.5rem', borderRadius: '24px', cursor: 'pointer', fontSize: '.9rem' }}
              >
                {loadMore ? <Spinner /> : `Xem thêm (${total - entries.length} người)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Modal thông tin người dùng ───────────────── */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'linear-gradient(135deg,#302b63,#24243e)', borderRadius: '20px', padding: '1.5rem', width: '100%', maxWidth: '320px', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
              <AvatarCell avatarUrl={selected.avatarUrl} name={selected.displayName} size={56} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>{selected.displayName ?? 'Ẩn danh'}</p>
                <p style={{ margin: 0, fontSize: '.85rem', color: '#fbbf24', fontWeight: 600 }}>Hạng #{selected.rank}</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '1.2rem' }}>
              {[
                { label: 'Điểm Uy Tín', value: selected.reputationScore.toFixed(2) },
                { label: 'Điểm TB', value: selected.avgScore.toFixed(2) },
                { label: 'Số lần thi', value: `${selected.examCount} lần` },
                { label: 'Xu hướng', value: `${TREND_ICON[selected.trend] ?? '—'} ${selected.trend === 'up' ? 'Tăng' : selected.trend === 'down' ? 'Giảm' : selected.trend === 'new' ? 'Mới' : 'Ổn định'}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,.08)', borderRadius: '12px', padding: '.75rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '.72rem', color: '#94a3b8', marginBottom: '.25rem' }}>{label}</p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{value}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setSelected(null)} style={{ width: '100%', padding: '.7rem', borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '.9rem' }}>
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ── Thanh ghim hạng của tôi ───────────────────── */}
      {myRank !== null && !myEntryLoaded && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(90deg,#302b63,#0f0c29)',
          borderTop: '1px solid rgba(255,255,255,.15)',
          padding: '.75rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <AvatarCell avatarUrl={profile.avatarUrl} name={profile.displayName} size={40} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '.9rem' }}>{profile.displayName ?? 'Bạn'}</p>
            {myRank.rank !== null ? (
              <p style={{ margin: 0, fontSize: '.78rem', color: '#94a3b8' }}>
                Hạng #{myRank.rank} · TB: {myRank.avgScore?.toFixed(1)} · {myRank.examCount} lần thi
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '.78rem', color: '#94a3b8' }}>Chưa có dữ liệu xếp hạng</p>
            )}
          </div>
          {myRank.rank !== null && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#fbbf24' }}>{myRank.reputationScore?.toFixed(1)}</p>
              {myRank.trend && (
                <span style={{ fontSize: '1rem', color: TREND_COLOR[myRank.trend] }}>{TREND_ICON[myRank.trend]}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LeaderboardPage;
export { TREND_ICON, TREND_COLOR };
