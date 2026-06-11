// Tiny organization-icon component used wherever we render a sub_entity
// (org) name — NoticeList card chip, search result chip, RecentRail row,
// NoticeDetailModal header, RegionCardV2's top-4 list, and the panel's
// OrgChip. Auto-generated mapping in src/data/orgIcons.js drives the
// happy path; the letter-circle fallback covers known-missing orgs
// (those in MISSING_ICONS) and any name we haven't seen before.
//
// Usage:
//   <OrgIcon name={sub_entity} size={14} />        // chips
//   <OrgIcon name={sub_entity} size={20} rounded /> // modal header
//
// The component is presentation-only (no click). Render it inside the
// existing button/link if you want it clickable.

import { useState } from 'react'
import { iconFor } from '../data/orgIcons.js'

// Compact, brand-compatible palette for the letter-circle fallback.
// All chosen to sit nicely next to --accent (#1565C0) without yelling.
const FALLBACK_COLORS = [
  { bg: '#1565C0', fg: '#FFFFFF' },   // accent
  { bg: '#1976D2', fg: '#FFFFFF' },   // primary-mid
  { bg: '#0D47A1', fg: '#FFFFFF' },   // deep navy
  { bg: '#2E7D32', fg: '#FFFFFF' },   // green
  { bg: '#6A1B9A', fg: '#FFFFFF' },   // purple
  { bg: '#00838F', fg: '#FFFFFF' },   // teal
  { bg: '#EF6C00', fg: '#FFFFFF' },   // orange (≠ select-warm, dimmer)
  { bg: '#C62828', fg: '#FFFFFF' },   // red
  { bg: '#455A64', fg: '#FFFFFF' },   // blue-grey
  { bg: '#5D4037', fg: '#FFFFFF' },   // brown
]

// Deterministic FNV-1a-ish hash so the same org always gets the same color.
function pickColor(name) {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const idx = Math.abs(h) % FALLBACK_COLORS.length
  return FALLBACK_COLORS[idx]
}

// First "visible" character: skip whitespace and brackets, prefer Hangul
// or Latin alphanumerics. For "LH 한국주택토지공사" we want "L"; for
// "광주시청 도시건설본부" we want "광".
function firstLetter(name) {
  if (!name) return '?'
  for (const ch of name) {
    if (/[\p{L}\p{N}]/u.test(ch)) return ch.toUpperCase()
  }
  return name.charAt(0) || '?'
}

export default function OrgIcon({
  name,
  size = 14,
  rounded = true,
  title,
  style,
}) {
  const [errored, setErrored] = useState(false)
  const src = name ? iconFor(name) : null
  const showImg = src && !errored

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: rounded ? Math.max(3, Math.round(size / 4)) : 0,
    overflow: 'hidden',
    verticalAlign: 'middle',
    ...style,
  }

  if (showImg) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        title={title ?? name}
        onError={() => setErrored(true)}
        style={{
          ...baseStyle,
          objectFit: 'contain',
          background: 'var(--bg-page)',
        }}
      />
    )
  }

  // Fallback: deterministic-color circle with the first letter
  const { bg, fg } = pickColor(name || '?')
  const letter = firstLetter(name)
  return (
    <span
      role="img"
      aria-label={name || ''}
      title={title ?? name}
      style={{
        ...baseStyle,
        background: bg,
        color: fg,
        fontSize: Math.max(8, Math.round(size * 0.6)),
        fontWeight: 700,
        lineHeight: 1,
        fontFamily: "'Noto Sans KR','Barlow',system-ui,sans-serif",
        userSelect: 'none',
      }}
    >
      {letter}
    </span>
  )
}
