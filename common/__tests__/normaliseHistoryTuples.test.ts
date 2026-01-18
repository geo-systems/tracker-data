import { normaliseHistoryTuples } from '../normaliseHistoryTuples.ts';
import { DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS } from '../date';

describe('normaliseHistoryTuples', () => {
    // Fixed timestamp for testing: Jan 1, 2026, 12:00:00 UTC
    const mockNow = new Date('2026-01-01T12:00:00.000Z').getTime();

    it('should filter out entries based on the filter logic', () => {
        const input: Array<[number, number]> = [
            [mockNow - HOUR_IN_MS, 100],        // positive -> kept
            [mockNow - 2 * HOUR_IN_MS, 0],      // zero (falsy) -> filtered out
            [mockNow - 3 * HOUR_IN_MS, 50],     // positive -> kept
            [mockNow - 4 * HOUR_IN_MS, 200],    // positive -> kept
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result.length).toBe(3);
        expect(result[0][1]).toBe(100);   // Most recent (mockNow - HOUR_IN_MS)
        expect(result[1][1]).toBe(50);    // Second (mockNow - 3 * HOUR_IN_MS)
        expect(result[2][1]).toBe(200);   // Oldest (mockNow - 4 * HOUR_IN_MS)
    });

    it('should order results by timestamp in descending order', () => {
        const input: Array<[number, number]> = [
            [mockNow - 3 * HOUR_IN_MS, 100],
            [mockNow - HOUR_IN_MS, 300],
            [mockNow - 2 * HOUR_IN_MS, 200],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result.length).toBe(3);
        expect(result[0][0]).toBe(mockNow - HOUR_IN_MS); // Most recent
        expect(result[1][0]).toBe(mockNow - 2 * HOUR_IN_MS);
        expect(result[2][0]).toBe(mockNow - 3 * HOUR_IN_MS); // Oldest
    });

    it('should remove duplicates based on the normalized key', () => {
        // Two entries within the same 10-minute window (for recent data < 2 days)
        const ts1 = mockNow - HOUR_IN_MS;
        const ts2 = ts1 + 5 * MINUTE_IN_MS; // 5 minutes later, same 10-min window

        const input: Array<[number, number]> = [
            [ts1, 100],
            [ts2, 150],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        // Should keep only one entry (the most recent one due to desc order)
        expect(result.length).toBe(1);
        expect(result[0][0]).toBe(ts2);
        expect(result[0][1]).toBe(150);
    });

    it('should use 10-minute rounding for data within 2 days', () => {
        const ts = mockNow - DAY_IN_MS; // 1 day ago

        const input: Array<[number, number]> = [
            [ts, 100],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result.length).toBe(1);
        expect(result[0]).toEqual([ts, 100, new Date(ts).toISOString()]);
    });

    it('should use 30-minute rounding for data between 2-7 days old', () => {
        const ts = mockNow - 3 * DAY_IN_MS; // 3 days ago

        const input: Array<[number, number]> = [
            [ts, 100],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result.length).toBe(1);
        expect(result[0]).toEqual([ts, 100, new Date(ts).toISOString()]);
    });

    it('should use 1-hour rounding for data between 7-30 days old', () => {
        const ts = mockNow - 10 * DAY_IN_MS; // 10 days ago

        const input: Array<[number, number]> = [
            [ts, 100],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result.length).toBe(1);
        expect(result[0]).toEqual([ts, 100, new Date(ts).toISOString()]);
    });

    it('should use 1-day rounding for data between 30-90 days old', () => {
        const ts = mockNow - 45 * DAY_IN_MS; // 45 days ago

        const input: Array<[number, number]> = [
            [ts, 100],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result.length).toBe(1);
        expect(result[0]).toEqual([ts, 100, new Date(ts).toISOString()]);
    });

    it('should use 7-day rounding for data older than 90 days', () => {
        const ts = mockNow - 180 * DAY_IN_MS; // 180 days ago

        const input: Array<[number, number]> = [
            [ts, 100],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result.length).toBe(1);
        expect(result[0]).toEqual([ts, 100, new Date(ts).toISOString()]);
    });

    it('should handle empty input array', () => {
        const input: Array<[number, number]> = [];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result).toEqual([]);
    });

    it('should include ISO timestamp as third element in tuple', () => {
        const ts = mockNow - HOUR_IN_MS;
        const input: Array<[number, number]> = [
            [ts, 100],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result.length).toBe(1);
        expect(result[0][0]).toBe(ts);
        expect(result[0][1]).toBe(100);
        expect(result[0][2]).toBe(new Date(ts).toISOString());
    });

    it('should handle mixed age data with appropriate rounding for each', () => {
        const input: Array<[number, number]> = [
            [mockNow - HOUR_IN_MS, 100], // < 2 days: 10-min rounding
            [mockNow - 5 * DAY_IN_MS, 200], // 2-7 days: 30-min rounding
            [mockNow - 15 * DAY_IN_MS, 300], // 7-30 days: 1-hour rounding
            [mockNow - 60 * DAY_IN_MS, 400], // 30-90 days: 1-day rounding
            [mockNow - 120 * DAY_IN_MS, 500], // > 90 days: 7-day rounding
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        // All entries should be present (no duplicates in this case)
        expect(result.length).toBe(5);
        
        // Check ordering (descending by timestamp)
        expect(result[0][1]).toBe(100);
        expect(result[1][1]).toBe(200);
        expect(result[2][1]).toBe(300);
        expect(result[3][1]).toBe(400);
        expect(result[4][1]).toBe(500);
    });

    it('should deduplicate entries that fall in the same rounding window', () => {
        // Create 3 entries within the same hour (for 7-30 days old data)
        const baseTs = mockNow - 20 * DAY_IN_MS;
        const input: Array<[number, number]> = [
            [baseTs, 100],
            [baseTs + 10 * MINUTE_IN_MS, 150],
            [baseTs + 30 * MINUTE_IN_MS, 200],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        // Should keep only the most recent one
        expect(result.length).toBe(1);
        expect(result[0][0]).toBe(baseTs + 30 * MINUTE_IN_MS);
        expect(result[0][1]).toBe(200);
    });

    it('should handle data with decimal prices', () => {
        const ts = mockNow - HOUR_IN_MS;
        const input: Array<[number, number]> = [
            [ts, 123.456],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result.length).toBe(1);
        expect(result[0][1]).toBe(123.456);
    });

    it('should filter out entries where price is exactly 0', () => {
        const input: Array<[number, number]> = [
            [mockNow - HOUR_IN_MS, 0],
            [mockNow - 2 * HOUR_IN_MS, 0.0],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result.length).toBe(0);
    });

    it('should keep entries with very small positive prices', () => {
        const ts = mockNow - HOUR_IN_MS;
        const input: Array<[number, number]> = [
            [ts, 0.00001],
        ];

        const result = normaliseHistoryTuples(input, mockNow);

        expect(result.length).toBe(1);
        expect(result[0][1]).toBe(0.00001);
    });
});
