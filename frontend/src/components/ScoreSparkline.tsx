/** Sparkline SVG don gian tu mang diem so. */
function ScoreSparkline({ points }: { points: { score: number }[] }) {
  if (points.length < 2) return <span className="progress-no-data">Chưa đủ dữ liệu</span>;
  const W = 280;
  const H = 60;
  const scores = points.map((p) => p.score);
  const maxS = Math.max(...scores, 1);
  const minS = Math.min(...scores);
  const range = maxS - minS || 1;
  const step = W / (scores.length - 1);
  const toY = (s: number) => H - 4 - ((s - minS) / range) * (H - 8);
  const d = scores
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${toY(s).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sparkline-svg" aria-hidden="true">
      <polyline points={scores.map((s, i) => `${(i * step).toFixed(1)},${toY(s).toFixed(1)}`).join(' ')}
        fill="none" stroke="var(--accent,#4f8ef7)" strokeWidth="2" strokeLinejoin="round" />
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="var(--accent,#4f8ef7)" fillOpacity="0.12" />
      {scores.map((s, i) => (
        <circle key={i} cx={(i * step).toFixed(1)} cy={toY(s).toFixed(1)} r="3"
          fill="var(--accent,#4f8ef7)" />
      ))}
    </svg>
  );
}

export default ScoreSparkline;
