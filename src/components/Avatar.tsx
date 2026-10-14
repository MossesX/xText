export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
  let hue = 0
  for (const ch of name) hue = (hue * 31 + ch.charCodeAt(0)) % 360
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 55% 45% / 0.18)`, color: `hsl(${hue} 55% 40%)` }} title={name}>
      {initials || '?'}
    </div>
  )
}
