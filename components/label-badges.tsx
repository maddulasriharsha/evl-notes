export type Style = 'typed' | 'handwritten'
export type Edition = 'r25' | 'old'

export const STYLE_LABEL: Record<Style, string> = { typed: 'Typed', handwritten: 'Handwritten' }
export const EDITION_LABEL: Record<Edition, string> = { r25: 'R25', old: 'Old syllabus' }

/** Reads the labels out of a note's tags. */
export function labelsOf(tags?: readonly string[] | null): { style?: Style; edition?: Edition } {
  const t = tags ?? []
  return {
    style: t.includes('typed') ? 'typed' : t.includes('handwritten') ? 'handwritten' : undefined,
    edition: t.includes('r25') ? 'r25' : t.includes('old') ? 'old' : undefined,
  }
}

/** Small tags on a file: R25 or Old syllabus, and Typed or Handwritten. */
export function LabelBadges({ style, edition }: { style?: Style | null; edition?: Edition | null }) {
  if (!style && !edition) return null
  return (
    <>
      {edition && (
        <span
          title={edition === 'r25' ? 'Follows the R25 syllabus' : 'From an older syllabus: check it against the R25 topics'}
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${edition === 'r25' ? 'bg-ok-soft text-ok' : 'bg-gold-soft text-gold'}`}
        >
          {EDITION_LABEL[edition]}
        </span>
      )}
      {style && (
        <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-2" title={style === 'typed' ? 'Typed notes' : 'Handwritten notes (scanned or photographed)'}>
          {STYLE_LABEL[style]}
        </span>
      )}
    </>
  )
}
