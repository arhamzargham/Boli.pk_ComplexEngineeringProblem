import { paisaToRs } from '@/lib/formatters'

describe('paisaToRs', () => {
  it('formats zero correctly', () => {
    expect(paisaToRs(0)).toBe('Rs. 0')
  })

  it('formats paisa to rupees', () => {
    expect(paisaToRs(100)).toBe('Rs. 1')
  })

  it('formats large amounts with commas (en-US locale)', () => {
    expect(paisaToRs(10_000_000)).toBe('Rs. 100,000')
  })

  it('never returns a decimal digit after the decimal point', () => {
    const result = paisaToRs(5000)
    // Should be "Rs. 50" — no decimal fraction (the period in "Rs." is part of the prefix)
    expect(result).not.toMatch(/\.\d/)
    expect(result).toContain('Rs.')
  })

  it('handles large demo amounts', () => {
    // Rs. 500,000 = 50,000,000 paisa
    expect(paisaToRs(50_000_000)).toBe('Rs. 500,000')
  })

  it('handles negative values gracefully', () => {
    const result = paisaToRs(-100)
    expect(typeof result).toBe('string')
  })
})
