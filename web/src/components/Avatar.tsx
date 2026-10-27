export function Avatar({ name, url, size = 40 }: { name?: string; url?: string | null; size?: number }) {
  const initials = (name ?? '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {url ? <img src={url} alt="" /> : initials || '·'}
    </span>
  );
}
