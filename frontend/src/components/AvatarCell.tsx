// ─── AvatarCell — hiện avatar hoặc initials trong bảng xếp hạng ─────────────

const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];

export default function AvatarCell({
  avatarUrl,
  name,
  size = 40,
}: {
  avatarUrl: string | null;
  name: string | null;
  size?: number;
}) {
  const initials = (name ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  const color    = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name ?? ''}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.38,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
