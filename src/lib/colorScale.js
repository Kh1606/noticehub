import { scaleSequential } from 'd3-scale'
import { interpolateBlues } from 'd3-scale-chromatic'

// d3's `interpolateBlues` runs near-white at 0 → deep navy at 1.
// Provinces with zero notices are colored separately (neutral gray), so this
// scale only handles count >= 1. We start at 0.35 so even count=1 is a clearly
// visible blue, and cap at 0.95 so the busiest regions don't go pure black.
//
// Shared by both the map heatmap (KoreaMap) and the 개요 region-card heat
// spine (RegionCardV2) — same input ⇒ same blue across both surfaces, which
// is what makes the two views read as one system.
export function makeColorScale(maxCount) {
  const domainMax = Math.max(1, maxCount)
  const seq = scaleSequential(interpolateBlues).domain([0, 1])
  return count => {
    if (!count || count <= 0) return null  // caller decides the "no data" color
    // Square-root scale so small counts get noticeable contrast, large counts
    // don't dominate (sqrt is gentler than linear for skewed distributions).
    const t = Math.sqrt(Math.min(1, count / domainMax))
    return seq(0.35 + t * 0.60)
  }
}
