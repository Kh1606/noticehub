// One place that owns "what happens when the user clicks a notice card".
//
// Used by NoticeList, OverviewSearch results, and RecentRail — all three
// previously opened an in-app modal (NoticeDetailModal, removed
// 2026-06-11). The new behavior: open the source page in a new tab.
// Centralized so a future "open in same tab" / "preview drawer" / etc.
// preference is one edit.

export function openNoticeUrl(notice) {
  const url = notice?.detail_url
  if (!url) return
  // 'noopener,noreferrer' is the standard pair to prevent the new tab
  // from getting a back-reference to our window via opener.
  window.open(url, '_blank', 'noopener,noreferrer')
}
