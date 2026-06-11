// Moved to src/lib/colorScale.js so both the map (KoreaMap) and the 개요
// region cards (RegionCardV2) can share one source of truth for "darker
// blue = more notices". This file is kept as a re-export shim to avoid
// touching every MapView import.
export { makeColorScale } from '../../lib/colorScale.js'
