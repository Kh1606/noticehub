// Keyword search helpers for the right-side panel.
//
// `splitTerms` — turns the user's input into an array of AND'd terms
//                (split on whitespace).
// `highlight`  — returns React children with case-insensitive matches
//                wrapped in styled <mark> elements (browser Ctrl+F style).

const HIGHLIGHT_STYLE = {
  background: '#FEF3C7',
  color: '#92400E',
  padding: '0 2px',
  borderRadius: 2,
  fontWeight: 700,
}

export function splitTerms(searchTerm) {
  return (searchTerm || '').trim().split(/\s+/).filter(Boolean)
}

export function highlight(text, terms) {
  if (!text || !terms?.length) return text
  const escaped = terms
    .filter(Boolean)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!escaped.length) return text
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const lowerTerms = terms.map(t => t.toLowerCase())
  // Split with capture group keeps matched parts in the result array;
  // we then mark anything whose lowercase exactly equals one of the terms.
  return text.split(re).map((part, i) => {
    const isMatch = lowerTerms.includes(part.toLowerCase())
    return isMatch
      ? <mark key={i} style={HIGHLIGHT_STYLE}>{part}</mark>
      : <span key={i}>{part}</span>
  })
}
