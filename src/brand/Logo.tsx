/**
 * The AmberX identity mark: a gradient hexagon carrying a white "A",
 * ported from the AmberX framework's painted logo so every surface shares one mark.
 */
export function AmberMark({ size = 32, accent = 'var(--c-primary)' }: { size?: number; accent?: string }) {
  const id = `amber-grad-${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <polygon points="20,2.5 35.2,11.25 35.2,28.75 20,37.5 4.8,28.75 4.8,11.25" fill={accent} />
      <polygon points="20,2.5 35.2,11.25 35.2,28.75 20,37.5 4.8,28.75 4.8,11.25" fill={`url(#${id})`} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
      <line x1="20" y1="10" x2="12.5" y2="21.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14.2 28.5 L20 11 L25.8 28.5 M16.8 21.5 L23.2 21.5" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Wordmark({ title, brand }: { title: string; brand: string }) {
  return (
    <span className="wordmark">
      <span className="wordmark-title">{title}</span>
      <span className="wordmark-by">by {brand}</span>
    </span>
  )
}
