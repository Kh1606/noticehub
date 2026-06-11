// Render-time display mapping for region names.
//
// regions.json contains one literal "-" region (인포21 — has no province
// affiliation). It looks awful as a card title, a chip, and a panel header,
// so we map it to "미분류" at render sites only. The raw "-" must still be
// used for every Supabase query (notices_v2.region matches the literal
// string), so never feed displayRegion() into a query.
const DISPLAY = {
  '-': '미분류',
}

export function displayRegion(name) {
  if (name == null) return name
  return DISPLAY[name] ?? name
}
