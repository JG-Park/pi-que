import { formatDuration, formatDurationFromMs, parseDuration } from '@/utils/time/formatDuration';

describe('formatDuration', () => {
  it('should format seconds correctly for values under an hour', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(30)).toBe('0:30');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('should format seconds correctly for values over an hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(7200)).toBe('2:00:00');
    expect(formatDuration(7265)).toBe('2:01:05');
    expect(formatDuration(86400)).toBe('24:00:00'); // 24 hours
  });

  it('should handle edge cases', () => {
    expect(formatDuration(NaN)).toBe('0:00');
    expect(formatDuration(Infinity)).toBe('0:00');
    expect(formatDuration(-10)).toBe('0:00');
  });

  it('should handle decimal values by flooring them', () => {
    expect(formatDuration(90.7)).toBe('1:30');
    expect(formatDuration(3661.9)).toBe('1:01:01');
  });
});

describe('formatDurationFromMs', () => {
  it('should convert milliseconds to seconds and format correctly', () => {
    expect(formatDurationFromMs(0)).toBe('0:00');
    expect(formatDurationFromMs(30000)).toBe('0:30');
    expect(formatDurationFromMs(60000)).toBe('1:00');
    expect(formatDurationFromMs(90500)).toBe('1:30'); // 90.5 seconds floored to 90
    expect(formatDurationFromMs(3600000)).toBe('1:00:00'); // 1 hour
  });

  it('should handle edge cases', () => {
    expect(formatDurationFromMs(NaN)).toBe('0:00');
    expect(formatDurationFromMs(Infinity)).toBe('0:00');
    expect(formatDurationFromMs(-1000)).toBe('0:00');
  });
});

describe('parseDuration', () => {
  it('should parse MM:SS format correctly', () => {
    expect(parseDuration('0:00')).toBe(0);
    expect(parseDuration('0:30')).toBe(30);
    expect(parseDuration('1:00')).toBe(60);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('10:45')).toBe(645);
    expect(parseDuration('59:59')).toBe(3599);
  });

  it('should parse HH:MM:SS format correctly', () => {
    expect(parseDuration('1:00:00')).toBe(3600);
    expect(parseDuration('1:01:01')).toBe(3661);
    expect(parseDuration('2:30:45')).toBe(9045);
    expect(parseDuration('24:00:00')).toBe(86400);
  });

  it('should handle single digit values', () => {
    expect(parseDuration('0:5')).toBe(5);
    expect(parseDuration('5:0')).toBe(300);
    expect(parseDuration('1:5:5')).toBe(3905);
  });

  it('should handle invalid formats gracefully', () => {
    expect(parseDuration('')).toBe(0);
    expect(parseDuration('invalid')).toBe(0);
    expect(parseDuration('1:2:3:4')).toBe(0); // Too many parts
    expect(parseDuration('1')).toBe(0); // Single number
    expect(parseDuration('a:b')).toBe(0); // Non-numeric values
    expect(parseDuration('1:abc')).toBe(0); // Partial non-numeric
  });

  it('should handle edge case values', () => {
    expect(parseDuration('0:0')).toBe(0);
    expect(parseDuration('00:00')).toBe(0);
    expect(parseDuration('00:00:00')).toBe(0);
  });
}); 