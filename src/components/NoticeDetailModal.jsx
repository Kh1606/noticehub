import { useEffect, useState, useCallback } from 'react'
import { X, ExternalLink, Paperclip, Download, FileText, Image as ImageIcon, FileArchive, AlertCircle, AlignLeft } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { formatDottedDate as formatDate } from '../lib/format.js'

/**
 * Notice detail modal — opened when the user clicks a notice card.
 *
 * Pulls attachments from the `fetch-notice-detail` Edge Function (which
 * caches in the `notice_details` table). Shows title + metadata + a list
 * of downloadable attachment buttons. "원문 보기" footer button always
 * goes to the source detail page for the full body.
 *
 * Closes on: X button, ESC key, backdrop click.
 */
// Sources whose "detail_url" is actually a homepage entry, not a notice
// detail page. The popup can't extract meaningful body/attachments from
// these — we skip the Edge Function call and show a small explainer.
const HOMEPAGE_PAGES = new Set(['메인페이지'])

export default function NoticeDetailModal({ notice, onClose }) {
  const [state, setState] = useState({
    status: 'loading', attachments: [], body: '', error: null,
  })

  const isHomepageLink = !!notice && HOMEPAGE_PAGES.has(notice.source_page || '')

  // Load body + attachments via Edge Function on mount
  useEffect(() => {
    if (!notice?.notice_id || !notice?.detail_url) return
    // Homepage-link sources have nothing to extract — short-circuit so we
    // don't burn an Edge Function call and don't show "정보를 불러올 수 없어요".
    if (HOMEPAGE_PAGES.has(notice.source_page || '')) {
      setState({ status: 'homepage', attachments: [], body: '', error: null })
      return
    }
    let cancelled = false
    setState({ status: 'loading', attachments: [], body: '', error: null })

    supabase.functions
      .invoke('fetch-notice-detail', {
        body: { notice_id: notice.notice_id, detail_url: notice.detail_url },
      })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({ status: 'error', attachments: [], body: '', error: error.message || String(error) })
        } else if (data?.status === 'error') {
          setState({ status: 'error', attachments: [], body: '', error: data.error_text || '정보를 불러올 수 없어요' })
        } else {
          setState({
            status: 'ok',
            attachments: data?.attachments || [],
            body: data?.body_text || '',
            error: null,
          })
        }
      })
      .catch(err => {
        if (cancelled) return
        setState({ status: 'error', attachments: [], body: '', error: err?.message || String(err) })
      })

    return () => { cancelled = true }
  }, [notice?.notice_id, notice?.detail_url])

  // ESC closes; lock body scroll
  useEffect(() => {
    const onKey = e => {
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

  const postedStr = formatDate(notice.posted_at)

  return (
    <div
      onClick={onBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-detail-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: 'min(720px, 100%)',
          maxHeight: '86vh',
          background: 'var(--bg-card, #fff)',
          borderRadius: 12,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            background: 'linear-gradient(180deg, #F5F9FF 0%, var(--bg-card) 100%)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: 8,
              }}
            >
              <MetaChip color="accent">{notice.source_page}</MetaChip>
              {notice.sub_entity && <MetaChip>{notice.sub_entity}</MetaChip>}
              {notice.region && <MetaChip>{notice.region}</MetaChip>}
              {postedStr && <MetaChip>{postedStr}</MetaChip>}
            </div>
            <h2
              id="notice-detail-title"
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.35,
                margin: 0,
                wordBreak: 'keep-all',
              }}
            >
              {notice.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기 (ESC)"
            title="닫기 (ESC)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'var(--bg-hover, #F3F4F6)',
              color: 'var(--text-secondary)',
              flexShrink: 0,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </header>

        {/* Scrollable content area: body + attachments */}
        <section
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '18px 22px',
          }}
        >
          {/* Homepage-link short-circuit — these aren't real detail pages */}
          {state.status === 'homepage' && (
            <div
              style={{
                padding: '24px 18px',
                textAlign: 'center',
                background: 'var(--bg-page, #F6F8FB)',
                border: '1px dashed var(--border)',
                borderRadius: 8,
                color: 'var(--text-secondary)',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                이 항목은 기관 사이트의 홈페이지 링크입니다.
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                개별 공지 상세가 아니므로 본문 / 첨부파일은 제공되지 않아요.
                <br />
                아래 <b>원문 보기</b>로 이동해 직접 확인해주세요.
              </div>
            </div>
          )}

          {/* Body section — hidden when empty */}
          {state.status === 'ok' && state.body && (
            <div style={{ marginBottom: 22 }}>
              <SectionLabel icon={<AlignLeft size={13} />} title="본문" />
              <div
                style={{
                  marginTop: 8,
                  padding: '14px 16px',
                  background: 'var(--bg-page, #F6F8FB)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'keep-all',
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                {state.body}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                ※ 본문 일부만 표시됩니다. 전체 내용은 <b>원문 보기</b>에서 확인하세요.
              </div>
            </div>
          )}

          {/* Attachments — hidden entirely when this is a homepage link */}
          {state.status !== 'homepage' && (
          <>
          <SectionLabel
            icon={<Paperclip size={13} />}
            title="첨부파일"
            count={state.status === 'ok' && state.attachments.length > 0 ? state.attachments.length : undefined}
          />

          <div style={{ marginTop: 10 }}>

          {state.status === 'loading' && <SkeletonRows />}

          {state.status === 'error' && (
            <div style={errorBox}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#B91C1C', marginBottom: 2 }}>
                  정보를 불러올 수 없어요
                </div>
                <div style={{ fontSize: 11, color: '#7F1D1D', wordBreak: 'break-all' }}>
                  {state.error}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  원문에서 직접 확인하실 수 있어요.
                </div>
              </div>
            </div>
          )}

          {state.status === 'ok' && state.attachments.length === 0 && (
            <div style={emptyBox}>
              첨부파일이 없어요. 본문 내용은 <b>원문 보기</b>에서 확인하세요.
            </div>
          )}

          {state.status === 'ok' && state.attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {state.attachments.map((att, i) => (
                <AttachmentRow key={att.url + i} att={att} />
              ))}
            </div>
          )}
          </div>
          </>
          )}
        </section>

        {/* Footer */}
        <footer
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-page, #F9FAFB)',
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
          }}
        >
          <button onClick={onClose} style={secondaryBtn}>
            닫기
          </button>
          <a
            href={notice.detail_url}
            target="_blank"
            rel="noopener noreferrer"
            style={primaryBtn}
          >
            원문 보기 <ExternalLink size={13} />
          </a>
        </footer>
      </div>
    </div>
  )
}

function SectionLabel({ icon, title, count }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--text-secondary)',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
      }}
    >
      {icon}
      <span>
        {title}
        {count != null && (
          <span style={{ marginLeft: 4, color: 'var(--accent)' }}>
            ({count}건)
          </span>
        )}
      </span>
    </div>
  )
}

function MetaChip({ children, color }) {
  const accent = color === 'accent'
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: 999,
        background: accent ? 'var(--accent-light, #EFF6FF)' : 'var(--bg-page, #F6F8FB)',
        color: accent ? 'var(--accent)' : 'var(--text-secondary)',
        border: '1px solid ' + (accent ? 'var(--accent-light, #DBEAFE)' : 'var(--border)'),
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function AttachmentRow({ att }) {
  const Icon = iconForExt(att.ext)
  const jsOnly = !!att.js_only
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      download={jsOnly ? undefined : att.name}
      title={jsOnly ? `${att.name} — 원문에서 다운로드` : att.name}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: jsOnly ? 'var(--bg-page, #F6F8FB)' : 'var(--bg-card)',
        border: '1px solid ' + (jsOnly ? 'var(--border)' : 'var(--border)'),
        borderRadius: 8,
        textDecoration: 'none',
        color: 'var(--text-primary)',
        transition: 'border-color 0.15s, background 0.15s, transform 0.12s',
        opacity: jsOnly ? 0.92 : 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        if (!jsOnly) e.currentTarget.style.background = 'var(--accent-light, #EFF6FF)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = jsOnly ? 'var(--bg-page, #F6F8FB)' : 'var(--bg-card)'
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
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.4, display: 'flex', alignItems: 'center', gap: 6 }}>
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

function SkeletonRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="skeleton"
          style={{
            height: 56,
            borderRadius: 8,
          }}
        />
      ))}
    </div>
  )
}

function iconForExt(ext) {
  if (!ext) return FileText
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) return ImageIcon
  if (['zip', '7z', 'tar', 'gz', 'rar'].includes(ext)) return FileArchive
  return FileText
}

function extColor(ext) {
  const e = (ext || '').toLowerCase()
  if (e === 'pdf')                        return { bg: '#FEE2E2', fg: '#991B1B' }
  if (e === 'hwp' || e === 'hwpx' || e === 'hwt') return { bg: '#DBEAFE', fg: '#1D4ED8' }
  if (e === 'doc' || e === 'docx')        return { bg: '#DBEAFE', fg: '#1D4ED8' }
  if (e === 'xls' || e === 'xlsx' || e === 'csv') return { bg: '#D1FAE5', fg: '#065F46' }
  if (e === 'ppt' || e === 'pptx')        return { bg: '#FFEDD5', fg: '#9A3412' }
  if (['zip', '7z', 'tar', 'gz', 'rar'].includes(e)) return { bg: '#F3E8FF', fg: '#6B21A8' }
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(e)) return { bg: '#FEF3C7', fg: '#92400E' }
  return { bg: 'var(--bg-page, #F6F8FB)', fg: 'var(--text-secondary)' }
}

const primaryBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 8,
  background: 'var(--accent, #2563EB)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'none',
}

const secondaryBtn = {
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  cursor: 'pointer',
}

const emptyBox = {
  padding: '20px 16px',
  textAlign: 'center',
  background: 'var(--bg-page, #F6F8FB)',
  border: '1px dashed var(--border)',
  borderRadius: 8,
  color: 'var(--text-muted)',
  fontSize: 13,
}

const errorBox = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  padding: '12px 14px',
  background: '#FEF2F2',
  border: '1px solid #FECACA',
  color: '#B91C1C',
  borderRadius: 8,
  fontSize: 12,
}
