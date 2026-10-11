import { describe, expect, it } from 'vitest'
import { allSubjects, PAPERS_UNIT } from '@/lib/curriculum'
import { classifyText, tokens } from '@/lib/classify'

// A subject whose chapter titles have enough distinctive words to be found from text alone.
const sample = allSubjects().find(
  ({ subject }) => subject.kind === 'theory' && subject.units.length >= 4 && subject.units.every((u) => tokens(u).size >= 1),
)!.subject

describe('classifyText', () => {
  it('finds the subject from its course code', () => {
    const r = classifyText(`${sample.code} lecture notes handwritten by the student for revision before the internal examination`)
    expect(r?.code).toBe(sample.code)
  })

  it('finds the subject and the chapter from the words in a chapter title', () => {
    const idx = 1
    const text = `${sample.name}. ${sample.units[idx]}. These notes explain the ${sample.units[idx]} with solved examples and diagrams for the semester.`
    const r = classifyText(text)
    expect(r?.code).toBe(sample.code)
    expect(r?.unit).toBe(idx + 1)
  })

  it('says nothing about text that is too short or generic', () => {
    expect(classifyText('hello world')).toBeNull()
    expect(classifyText('this is a long sentence about nothing in particular that talks about lunch and the weather today')).toBeNull()
  })

  it('treats an exam paper as the question-papers shelf', () => {
    const r = classifyText(`${sample.code} ${sample.name} Question Paper Time: 3 hours Max Marks: 70 answer all questions from each section`)
    expect(r?.code).toBe(sample.code)
    expect(r?.unit).toBe(PAPERS_UNIT)
  })
})
