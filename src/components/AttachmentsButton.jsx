// Small footer button rendered on notice cards that actually have
// attachments. Clicking it opens <AttachmentsPopup>. Clicking elsewhere
// on the card opens the source URL — so this button MUST stop click
// propagation.

import { Paperclip } from 'lucide-react'

export default function AttachmentsButton({ count, onOpen }) {
  if (!count) return null
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onOpen?.()
      }}
      title={count === 1 ? '첨부파일 보기' : `첨부파일 ${count}개 보기`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--accent)',
        background: 'var(--accent-light)',
        border: '1px solid var(--accent-light)',
        borderRadius: 999,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, transform 0.12s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--accent-light)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <Paperclip size={12} />
      {count === 1 ? '첨부파일' : `첨부 ${count}`}
    </button>
  )
}
