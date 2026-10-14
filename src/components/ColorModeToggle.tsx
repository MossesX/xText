import { Moon, Sun, Monitor } from 'lucide-react'
import { useUI } from '../store/ui'
import type { ColorMode } from '../theme/apply'

const MODES: { mode: ColorMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'system', icon: Monitor, label: 'System' },
]

export function ColorModeToggle({ labels = false }: { labels?: boolean }) {
  const colorMode = useUI((s) => s.colorMode)
  const set = useUI((s) => s.setColorMode)
  return (
    <div className="segmented" role="radiogroup" aria-label="Colour mode">
      {MODES.map(({ mode, icon: Icon, label }) => (
        <button key={mode} type="button" role="radio" aria-checked={colorMode === mode} className={colorMode === mode ? 'active' : ''} onClick={() => set(mode)} title={label}>
          <Icon size={14} />
          {labels && label}
        </button>
      ))}
    </div>
  )
}
