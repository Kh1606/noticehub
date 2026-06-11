// Small centered modal that lists a notice's attachments with download
// buttons. Replaces the much larger NoticeDetailModal (which also
// rendered body text — now removed). Pure presentation: takes a notice
// that already has `attachments` populated (via lib/withAttachments.js)
// and never fetches anything.

import { useCallback, useEffect } from 'react'
import {
  X,
  Paperclip,
  ExternalLink,
  Download,
  FileText,
  Image as ImageIcon,
  FileArchive,
} from 'lucide-react'

export default function AttachmentsPopup({ notice, onClose }) {
  // ESC closes + body scroll lock + backdrop click closes.
  // Copied from the old NoticeDetailModal so the close UX is identical.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
      }
    }
    document.addEventListener('keydown', onKey, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const onBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose?.()
  }, [onClose])

  if (!notice) return null
  const attachments = notice.attachments || []
  const count = attachments.length

  return (
    <div
      onClick={onBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="attachments-popup-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(13, 27, 110, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="document"
        style={{
          width: 'min(480px, 100%)',
          maxHeight: '85vh',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(180deg, #F5F9FF 0%, var(--bg-card) 100%)',
          }}
        >
          <Paperclip size={16} color="var(--accent)" />
          <h2
            id="attachments-popup-title"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            첨부파일
            <span
              style={{
                marginLeft: 8,
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: 12,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {count}
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기 (ESC)"
            title="닫기 (ESC)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 999,
              background: 'var(--bg-hover)',
              color: 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </header>

        {/* Notice title (truncated, small) — gives the user context
            without dominating the popup. */}
        {notice.title && (
          <div
            style={{
              padding: '10px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-page)',
            }}
          >
            <div
              title={notice.title}
              className="line-clamp-2"
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
                wordBreak: 'keep-all',
              }}
            >
              {notice.title}
            </div>
          </div>
        )}

        {/* Attachment list */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '12px 18px',
          }}
        >
          {count === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: 12,
              }}
            >
              첨부파일이 없습니다.
            </div>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {attachments.map((att, i) => (
                <li key={i}>
                  <AttachmentRow att={att} sourceUrl={notice.detail_url} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer — link to the source page */}
        {notice.detail_url && (
          <footer
            style={{
              padding: '10px 18px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-page)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <a
              href={notice.detail_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              원문 보기 <ExternalLink size={12} />
            </a>
          </footer>
        )}
      </div>
    </div>
  )
}

// Copied verbatim from NoticeDetailModal.AttachmentRow — single file
// download row with the js_only fallback (sites whose attachment
// hrefs are JavaScript handlers we can't honor; we point at the source
// page instead and tag the row with an amber "원문에서 다운로드" hint).
function AttachmentRow({ att, sourceUrl }) {
  const Icon = iconForExt(att.ext)
  const jsOnly = !!att.js_only
  // js_only attachments point href at the source page rather than the
  // file (since we can't synthesize the JS-only download URL).
  const href = jsOnly ? (sourceUrl || att.url) : att.url
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={jsOnly ? undefined : att.name}
      title={jsOnly ? `${att.name} — 원문에서 다운로드` : att.name}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: jsOnly ? 'var(--bg-page)' : 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        textDecoration: 'none',
        color: 'var(--text-primary)',
        transition: 'border-color 0.15s, background 0.15s, transform 0.12s',
        opacity: jsOnly ? 0.92 : 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        if (!jsOnly) e.currentTarget.style.background = 'var(--accent-light)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = jsOnly ? 'var(--bg-page)' : 'var(--bg-card)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 6,
          background: extColor(att.ext).bg,
          color: extColor(att.ext).fg,
          flexShrink: 0,
          opacity: jsOnly ? 0.8 : 1,
        }}
      >
        <Icon size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: jsOnly ? 'var(--text-secondary)' : 'var(--text-primary)',
          }}
          title={att.name}
        >
          {att.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: 0.4,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 2,
          }}
        >
          {att.ext && <span style={{ textTransform: 'uppercase' }}>{att.ext}</span>}
          {jsOnly && (
            <span
              style={{
                padding: '1px 6px',
                background: '#FEF3C7',
                color: '#92400E',
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 9,
              }}
            >
              원문에서 다운로드
            </span>
          )}
        </div>
      </div>
      {jsOnly ? (
        <ExternalLink size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      ) : (
        <Download size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      )}
    </a>
  )
}

// Copied from NoticeDetailModal — same file-icon mapping.
function iconForExt(ext) {
  if (!ext) return FileText
  const e = ext.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(e)) return ImageIcon
  if (['zip', '7z', 'tar', 'gz', 'rar'].includes(e)) return FileArchive
  return FileText
}

// Copied from NoticeDetailModal — same per-extension palette.
function extColor(ext) {
  const e = (ext || '').toLowerCase()
  if (e === 'pdf')                                  return { bg: '#FEE2E2', fg: '#991B1B' }
  if (e === 'hwp' || e === 'hwpx' || e === 'hwt')   return { bg: '#DBEAFE', fg: '#1D4ED8' }
  if (e === 'doc' || e === 'docx')                  return { bg: '#DBEAFE', fg: '#1D4ED8' }
  if (e === 'xls' || e === 'xlsx' || e === 'csv')   return { bg: '#D1FAE5', fg: '#065F46' }
  if (e === 'ppt' || e === 'pptx')                  return { bg: '#FFEDD5', fg: '#9A3412' }
  if (['zip', '7z', 'tar', 'gz', 'rar'].includes(e)) return { bg: '#F3E8FF', fg: '#6B21A8' }
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(e)) return { bg: '#FEF3C7', fg: '#92400E' }
  return { bg: 'var(--bg-page)', fg: 'var(--text-secondary)' }
}
