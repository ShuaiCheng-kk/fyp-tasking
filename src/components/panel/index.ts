/**
 * Panel/Block design spec (canonical) — source of truth lives HERE, not in prose docs or memory.
 *
 * - Block title row: 30x30 icon badge (radius 9, #FFF7ED bg, #F97316 icon) + title (14px/700/#0F172A, letterSpacing -0.2px).
 * - SectionBlock: standalone card (white, 1px #E5E7EB border, radius 18, padding 22, single shadow).
 * - ShowcaseCard: larger card variant with header search input and scrollable body (radius 14, same border/shadow).
 * - Empty states: #F8FAFC background, radius 14, padding 32px 0, muted icon (#CBD5E1) + muted text (#94A3B8, 12px).
 * - TitledBlock: the Owner-page block language (reference: Activity Log / Departments on
 *   src/app/owner/team/page.tsx) — padded card (18/24/20, radius 14, soft shadow) with a header row
 *   (30x30 icon badge, 18px/700 title), an inset divider, then the body. No subtitles, ever.
 */

export { default as SectionBlock } from './SectionBlock'
export { default as ShowcaseCard } from './ShowcaseCard'
export { default as TitledBlock } from './TitledBlock'
