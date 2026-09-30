import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { determineStatus } from './determine-status'
import { SavingStatus } from './types'

describe('determineStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const baseDate = new Date('2024-01-01')
  const futureDate = new Date('2025-12-31')
  const pastDate = new Date('2023-01-01')

  it('should return "completed" when amount >= goal', () => {
    vi.setSystemTime(baseDate)
    const result = determineStatus(1000, 1000, futureDate.toISOString(), baseDate.toISOString())
    expect(result).toBe<SavingStatus>('completed')
  })

  it('should return "completed" when amount > goal', () => {
    vi.setSystemTime(baseDate)
    const result = determineStatus(1500, 1000, futureDate.toISOString(), baseDate.toISOString())
    expect(result).toBe<SavingStatus>('completed')
  })

  it('should return "atRisk" when target date is in the past', () => {
    vi.setSystemTime(baseDate)
    const result = determineStatus(500, 1000, pastDate.toISOString(), baseDate.toISOString())
    expect(result).toBe<SavingStatus>('atRisk')
  })

  it('should return "atRisk" when savings rate is below 70% of expected', () => {
    // Goal: 1000, total days: 365, expected daily: ~2.74
    // After 100 days, should have: ~274, but only have 100 (36% of expected)
    const created = new Date('2024-01-01')
    const target = new Date('2024-12-31')
    const today = new Date('2024-04-10') // ~100 days later
    
    vi.setSystemTime(today)
    const result = determineStatus(100, 1000, target.toISOString(), created.toISOString())
    expect(result).toBe<SavingStatus>('atRisk')
  })

  it('should return "active" when on track', () => {
    const created = new Date('2024-01-01')
    const target = new Date('2024-12-31')
    const today = new Date('2024-06-15') // ~166 days later
    
    vi.setSystemTime(today)
    // Goal: 1000, total days: 365, expected daily: ~2.74
    // After 166 days, should have: ~455, we have 500 (110% of expected)
    const result = determineStatus(500, 1000, target.toISOString(), created.toISOString())
    expect(result).toBe<SavingStatus>('active')
  })

  it('should handle edge case with same created and target date', () => {
    const date = new Date('2024-01-01')
    vi.setSystemTime(date)
    const result = determineStatus(500, 1000, date.toISOString(), date.toISOString())
    // Should not crash and return a valid status
    expect(['active', 'atRisk', 'completed']).toContain(result)
  })

  it('should return "active" when there is no target date and the goal is not yet met', () => {
    vi.setSystemTime(baseDate)
    const result = determineStatus(500, 1000, null, baseDate.toISOString())
    expect(result).toBe<SavingStatus>('active')
  })

  it('should return "active" when target date is undefined and the goal is not yet met', () => {
    vi.setSystemTime(baseDate)
    const result = determineStatus(500, 1000, undefined, baseDate.toISOString())
    expect(result).toBe<SavingStatus>('active')
  })

  it('should return "completed" with no target date when amount >= goal', () => {
    vi.setSystemTime(baseDate)
    const result = determineStatus(1000, 1000, null, baseDate.toISOString())
    expect(result).toBe<SavingStatus>('completed')
  })

  it('should accept numeric strings for amount and goal', () => {
    vi.setSystemTime(baseDate)
    const result = determineStatus('1000', '1000', futureDate.toISOString(), baseDate.toISOString())
    expect(result).toBe<SavingStatus>('completed')
  })

  it('should return "active" when there is no goal set, regardless of target date', () => {
    vi.setSystemTime(baseDate)
    const result = determineStatus(500, null, futureDate.toISOString(), baseDate.toISOString())
    expect(result).toBe<SavingStatus>('active')
  })

  it('should return "active" when goal is undefined', () => {
    vi.setSystemTime(baseDate)
    const result = determineStatus(500, undefined, pastDate.toISOString(), baseDate.toISOString())
    expect(result).toBe<SavingStatus>('active')
  })
})

