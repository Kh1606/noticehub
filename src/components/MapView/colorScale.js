import { scaleSequential } from 'd3-scale'
import { interpolateBlues } from 'd3-scale-chromatic'

// d3's `interpolateBlues` runs near-white at 0 → deep navy at 1.
// We compress the range to [0.18, 0.95] so even zero-count regions feel
// part of the CLT+ blue family, and the busiest regions don't go too dark.
export function makeColorScale(maxCount) {
  const domainMax = Math.max(1, maxCount)
  const seq = scaleSequential(interpolateBlues).domain([0, domainMax])
  return count => {
    const t = Math.min(1, (count ?? 0) / domainMax)
    const compressed = 0.18 + t * 0.77
    return seq.copy().domain([0, 1])(compressed)
  }
}
