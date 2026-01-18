export const MINUTE_IN_MS = 60 * 1000;
export const HOUR_IN_MS = 60 * MINUTE_IN_MS;
export const DAY_IN_MS = 24 * HOUR_IN_MS;
export const WEEK_IN_MS = 7 * DAY_IN_MS;
export const MONTH_IN_MS = 30 * DAY_IN_MS;

export const nextDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const nextDayTimestamp = date.getTime() + (24 * 60 * 60 * 1000);
    const nextDay = new Date(nextDayTimestamp);
    return nextDay.toISOString().split('T')[0];
}

export const toDateIso = (ts: number | Date, daysAgo: number = 0): string => {
  let adjustedDate: Date;
  if (daysAgo > 0) {
    const date = typeof ts === 'number' ? new Date(ts) : ts;
    adjustedDate = new Date(date.getTime() - (daysAgo * DAY_IN_MS));
  } else {
    adjustedDate = typeof ts === 'number' ? new Date(ts) : ts;
  }
  return adjustedDate.toISOString().split('T')[0];
}

export const roundToNearest = (ts: number, base: number,  units: number) => {
  const msInInterval = base * units;
  
  // Get total milliseconds since Unix epoch, divide by the interval's milliseconds,
  // round to the nearest integer, then multiply back to get the rounded milliseconds.
  const roundedMs = Math.floor(ts / msInInterval) * msInInterval;
  
  return roundedMs;
}

export const START_OF_CRYPTO = new Date('2009-01-01T00:00:00Z');
export const START_OF_CRYPTO_DAY = toDateIso(START_OF_CRYPTO);

