'use client'

// Line icons for the expense categories (replace emoji in the main flows).
// Colour comes from a single mid-tone per category so it reads on both the light and dark theme.
const PATHS = {
  Food: <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10" />,
  Transport: <><path d="M5 16l1.5-6a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 16" /><rect x="3" y="16" width="18" height="4" rx="1.5" /></>,
  Shopping: <><path d="M6 8h12l1 12H5L6 8z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
  Bills: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
  Smoking: <path d="M3 16h13v3H3zM19 16v3M22 16v3M18 12c0-2 2-2 2-4" />,
  Entertainment: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16M16 4v16M3 9h5M16 9h5M3 15h5M16 15h5" /></>,
  Health: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  Transfer: <path d="M5 8h14M15 4l4 4-4 4M19 16H5M9 12l-4 4 4 4" />,
  Other: <><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>,
}

export const CATEGORY_COLORS = {
  Food: '#C2610A',
  Transport: '#2F6FDB',
  Shopping: '#8B3FD1',
  Bills: '#A67C00',
  Smoking: '#2E8B57',
  Entertainment: '#C2398A',
  Health: '#D92D20',
  Transfer: '#2F4BEA',
  Other: '#6B7690',
}

/** tile: draw the icon on a tinted rounded square; otherwise the bare glyph. */
export default function CategoryIcon({ id, size = 20, tile = false }) {
  const key = PATHS[id] ? id : 'Other'
  const color = CATEGORY_COLORS[key]
  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[key]}
    </svg>
  )
  if (!tile) return <span style={{ display: 'inline-flex', color }}>{icon}</span>
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
        width: size * 2, height: size * 2, borderRadius: size * 0.6, color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      {icon}
    </span>
  )
}
