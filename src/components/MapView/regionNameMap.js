// Maps the geojson `name` property of each 시·도 polygon to the exact `region`
// string used in src/data/regions.json (and the Supabase `notices.region` column).
// Only two aliases — every other 시·도 name matches verbatim.
export const GEO_TO_REGION = {
  '세종특별자치시': '세종특별시',
  '제주특별자치도': '제주도',
}

export function geoNameToRegion(geoName) {
  return GEO_TO_REGION[geoName] ?? geoName
}

// Regions in regions.json that have no map polygon. Surfaced as separate chips.
export const NON_GEOGRAPHIC_REGIONS = new Set(['-', '기타', '창원시', '공사'])
