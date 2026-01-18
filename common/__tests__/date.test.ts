import { nextDate, toDateIso, roundToNearest, MINUTE_IN_MS, HOUR_IN_MS, DAY_IN_MS, WEEK_IN_MS, MONTH_IN_MS, START_OF_CRYPTO, START_OF_CRYPTO_DAY } from '../date';

describe('date.ts', () => {

    describe('nextDate', () => {
        it('should return the next day in ISO format', () => {
            expect(nextDate('2026-01-01')).toBe('2026-01-02');
            expect(nextDate('2026-01-31')).toBe('2026-02-01');
            expect(nextDate('2026-12-31')).toBe('2027-01-01');
        });

        it('should handle leap years correctly', () => {
            expect(nextDate('2024-02-28')).toBe('2024-02-29');
            expect(nextDate('2024-02-29')).toBe('2024-03-01');
        });

        it('should handle non-leap years correctly', () => {
            expect(nextDate('2025-02-28')).toBe('2025-03-01');
        });

        it('should handle month transitions', () => {
            expect(nextDate('2026-04-30')).toBe('2026-05-01');
            expect(nextDate('2026-06-30')).toBe('2026-07-01');
        });
    });

    describe('toDateIso', () => {
        const testTimestamp = new Date('2026-01-15T12:30:45.123Z').getTime();
        const testDate = new Date('2026-01-15T12:30:45.123Z');

        it('should convert timestamp to ISO date string', () => {
            expect(toDateIso(testTimestamp)).toBe('2026-01-15');
        });

        it('should convert Date object to ISO date string', () => {
            expect(toDateIso(testDate)).toBe('2026-01-15');
        });

        it('should handle daysAgo parameter with timestamp', () => {
            expect(toDateIso(testTimestamp, 1)).toBe('2026-01-14');
            expect(toDateIso(testTimestamp, 5)).toBe('2026-01-10');
            expect(toDateIso(testTimestamp, 15)).toBe('2025-12-31');
        });

        it('should handle daysAgo parameter with Date object', () => {
            expect(toDateIso(testDate, 1)).toBe('2026-01-14');
            expect(toDateIso(testDate, 5)).toBe('2026-01-10');
        });

        it('should default to 0 days ago when daysAgo is not provided', () => {
            expect(toDateIso(testTimestamp)).toBe('2026-01-15');
            expect(toDateIso(testDate)).toBe('2026-01-15');
        });

        it('should handle daysAgo of 0 explicitly', () => {
            expect(toDateIso(testTimestamp, 0)).toBe('2026-01-15');
            expect(toDateIso(testDate, 0)).toBe('2026-01-15');
        });

        it('should handle large daysAgo values', () => {
            expect(toDateIso(testTimestamp, 365)).toBe('2025-01-15');
            expect(toDateIso(testTimestamp, 730)).toBe('2024-01-16'); // Leap year
        });
    });

    describe('roundToNearest', () => {
        const baseTimestamp = new Date('2026-01-15T12:34:56.789Z').getTime();

        it('should round to nearest 10 minutes', () => {
            const rounded = roundToNearest(baseTimestamp, MINUTE_IN_MS, 10);
            const roundedDate = new Date(rounded);
            expect(roundedDate.getMinutes() % 10).toBe(0);
            expect(roundedDate.getSeconds()).toBe(0);
            expect(roundedDate.getMilliseconds()).toBe(0);
        });

        it('should round to nearest 30 minutes', () => {
            const rounded = roundToNearest(baseTimestamp, MINUTE_IN_MS, 30);
            const roundedDate = new Date(rounded);
            expect(roundedDate.getMinutes() % 30).toBe(0);
            expect(roundedDate.getSeconds()).toBe(0);
            expect(roundedDate.getMilliseconds()).toBe(0);
        });

        it('should round to nearest hour', () => {
            const rounded = roundToNearest(baseTimestamp, HOUR_IN_MS, 1);
            const roundedDate = new Date(rounded);
            expect(roundedDate.getMinutes()).toBe(0);
            expect(roundedDate.getSeconds()).toBe(0);
            expect(roundedDate.getMilliseconds()).toBe(0);
        });

        it('should round to nearest day', () => {
            const rounded = roundToNearest(baseTimestamp, DAY_IN_MS, 1);
            const roundedDate = new Date(rounded);
            expect(roundedDate.getUTCHours()).toBe(0);
            expect(roundedDate.getUTCMinutes()).toBe(0);
            expect(roundedDate.getUTCSeconds()).toBe(0);
            expect(roundedDate.getUTCMilliseconds()).toBe(0);
        });

        it('should round to nearest 7 days (week)', () => {
            const rounded = roundToNearest(baseTimestamp, DAY_IN_MS, 7);
            const roundedDate = new Date(rounded);
            expect(roundedDate.getUTCHours()).toBe(0);
            expect(roundedDate.getUTCMinutes()).toBe(0);
            expect(roundedDate.getUTCSeconds()).toBe(0);
            expect(roundedDate.getUTCMilliseconds()).toBe(0);
        });

        it('should round down (floor) to the nearest interval', () => {
            // Test that it rounds down, not to nearest
            const ts1 = new Date('2026-01-15T12:35:00.000Z').getTime();
            const ts2 = new Date('2026-01-15T12:39:59.999Z').getTime();
            
            const rounded1 = roundToNearest(ts1, MINUTE_IN_MS, 10);
            const rounded2 = roundToNearest(ts2, MINUTE_IN_MS, 10);
            
            expect(rounded1).toBe(rounded2); // Both should round to same 10-min mark
            expect(new Date(rounded1).toISOString()).toBe('2026-01-15T12:30:00.000Z');
        });

        it('should handle exact interval boundaries', () => {
            const exactHour = new Date('2026-01-15T12:00:00.000Z').getTime();
            const rounded = roundToNearest(exactHour, HOUR_IN_MS, 1);
            expect(rounded).toBe(exactHour);
        });

        it('should handle multiple units correctly', () => {
            const ts = new Date('2026-01-15T14:30:00.000Z').getTime();
            
            // Round to nearest 6 hours
            const rounded = roundToNearest(ts, HOUR_IN_MS, 6);
            const roundedDate = new Date(rounded);
            
            expect(roundedDate.getUTCHours() % 6).toBe(0);
            expect(roundedDate.getUTCMinutes()).toBe(0);
        });

        it('should handle very small timestamps', () => {
            const smallTs = 123456;
            const rounded = roundToNearest(smallTs, MINUTE_IN_MS, 1);
            expect(rounded).toBeLessThanOrEqual(smallTs);
            expect(rounded % MINUTE_IN_MS).toBe(0);
        });

        it('should handle very large timestamps', () => {
            const largeTs = new Date('2099-12-31T23:59:59.999Z').getTime();
            const rounded = roundToNearest(largeTs, DAY_IN_MS, 1);
            expect(rounded).toBeLessThanOrEqual(largeTs);
        });
    });
});
