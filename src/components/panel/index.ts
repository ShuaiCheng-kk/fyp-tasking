/**
 * Panel/Block design spec (canonical) — source of truth lives HERE, not in prose docs or memory.
 *
 * - Block title row: 30x30 icon badge (radius 9, #FFF7ED bg, #F97316 icon) + title (14px/700/#0F172A, letterSpacing -0.2px).
 * - SectionBlock: standalone card (white, 1px #E5E7EB border, radius 18, padding 22, single shadow).
 * - ShowcaseCard: larger card variant with header search input and scrollable body (radius 14, same border/shadow).
 * - Empty states: #F8FAFC background, radius 14, padding 32px 0, muted icon (#CBD5E1) + muted text (#94A3B8, 12px).
 */

export { default as SectionBlock } from './SectionBlock'
export { default as ShowcaseCard } from './ShowcaseCard'
