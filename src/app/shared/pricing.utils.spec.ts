import { addNightsToDate, calculateNightCount } from './pricing.utils';

describe('pricing date utilities', () => {
  it('counts calendar nights regardless of check-in time', () => {
    expect(calculateNightCount('2025-03-08T23:30', '2025-03-10')).toBe(2);
  });

  it('returns null when the date range is missing or invalid', () => {
    expect(calculateNightCount('2025-02-30', '2025-03-02')).toBeNull();
    expect(calculateNightCount('2025-03-10', '2025-03-10')).toBeNull();
  });

  it('adds nights without shifting the calendar date', () => {
    expect(addNightsToDate('2025-01-31', 2)).toBe('2025-02-02');
    expect(addNightsToDate('2025-03-08T15:00', 1)).toBe('2025-03-09');
  });
});