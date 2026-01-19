import { XMLParser } from "fast-xml-parser";
import { fetchEcbData, fetchSupportedCurrencies } from '../ecb.ts';
import * as fetchModule from '../../common/fetch.ts';
import { MockClock } from '../../common/MockClock.ts';

jest.mock('../../common/fetch.ts');

// Real ECB XML payload (abbreviated for testing)
const mockDailyXML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
    <gesmes:subject>Reference rates</gesmes:subject>
    <gesmes:Sender>
        <gesmes:name>European Central Bank</gesmes:name>
    </gesmes:Sender>
    <Cube>
        <Cube time="2024-01-15">
            <Cube currency="USD" rate="1.0876"/>
            <Cube currency="JPY" rate="160.23"/>
            <Cube currency="BGN" rate="1.9558"/>
            <Cube currency="CZK" rate="24.725"/>
            <Cube currency="DKK" rate="7.4563"/>
            <Cube currency="GBP" rate="0.85338"/>
            <Cube currency="HUF" rate="384.50"/>
            <Cube currency="PLN" rate="4.3395"/>
            <Cube currency="RON" rate="4.9745"/>
            <Cube currency="SEK" rate="11.2753"/>
            <Cube currency="CHF" rate="0.9315"/>
            <Cube currency="ISK" rate="149.80"/>
            <Cube currency="NOK" rate="11.4675"/>
            <Cube currency="TRY" rate="33.4512"/>
            <Cube currency="AUD" rate="1.6342"/>
            <Cube currency="BRL" rate="5.3796"/>
            <Cube currency="CAD" rate="1.4508"/>
            <Cube currency="CNY" rate="7.8154"/>
            <Cube currency="HKD" rate="8.4889"/>
            <Cube currency="IDR" rate="16965.37"/>
            <Cube currency="ILS" rate="4.0327"/>
            <Cube currency="INR" rate="90.5085"/>
            <Cube currency="KRW" rate="1438.95"/>
            <Cube currency="MXN" rate="18.5284"/>
            <Cube currency="MYR" rate="5.0749"/>
            <Cube currency="NZD" rate="1.7891"/>
            <Cube currency="PHP" rate="60.523"/>
            <Cube currency="SGD" rate="1.4448"/>
            <Cube currency="THB" rate="38.052"/>
            <Cube currency="ZAR" rate="20.3456"/>
        </Cube>
    </Cube>
</gesmes:Envelope>`;

const mock90DaysXML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
    <gesmes:subject>Reference rates</gesmes:subject>
    <gesmes:Sender>
        <gesmes:name>European Central Bank</gesmes:name>
    </gesmes:Sender>
    <Cube>
        <Cube time="2024-01-15">
            <Cube currency="USD" rate="1.0876"/>
            <Cube currency="GBP" rate="0.85338"/>
            <Cube currency="JPY" rate="160.23"/>
        </Cube>
        <Cube time="2024-01-12">
            <Cube currency="USD" rate="1.0891"/>
            <Cube currency="GBP" rate="0.85425"/>
            <Cube currency="JPY" rate="160.89"/>
        </Cube>
        <Cube time="2024-01-11">
            <Cube currency="USD" rate="1.0923"/>
            <Cube currency="GBP" rate="0.85612"/>
            <Cube currency="JPY" rate="161.45"/>
        </Cube>
    </Cube>
</gesmes:Envelope>`;

const mockHistoricalXMLWithOldDates = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
    <gesmes:subject>Reference rates</gesmes:subject>
    <gesmes:Sender>
        <gesmes:name>European Central Bank</gesmes:name>
    </gesmes:Sender>
    <Cube>
        <Cube time="2010-06-15">
            <Cube currency="USD" rate="1.2234"/>
            <Cube currency="GBP" rate="0.82450"/>
        </Cube>
        <Cube time="2008-12-20">
            <Cube currency="USD" rate="1.3952"/>
            <Cube currency="GBP" rate="0.91234"/>
        </Cube>
        <Cube time="2010-03-10">
            <Cube currency="USD" rate="1.3641"/>
            <Cube currency="GBP" rate="0.89876"/>
        </Cube>
    </Cube>
</gesmes:Envelope>`;

describe('ecb.ts', () => {
    let mockClock: MockClock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClock = new MockClock(1609459200000);
    });

    describe('fetchEcbData', () => {
        it('should fetch and parse daily ECB data', async () => {
            (fetchModule.getRetry as jest.Mock).mockResolvedValue(mockDailyXML);

            const result = await fetchEcbData(mockClock, 'daily');

            expect(fetchModule.getRetry).toHaveBeenCalledWith(
                mockClock,
                'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
                expect.objectContaining({
                    retries: 3,
                    delayMs: 5000,
                    jitterMs: 200,
                    headers: {
                        'Accept': 'application/xml',
                    },
                })
            );

            // Check the main date entry
            expect(result['2024-01-15']).toBeDefined();
            expect(result['2024-01-15'].EUR).toBeCloseTo(0.9195, 4); // 1 / 1.0876
            expect(result['2024-01-15'].USD).toBe(1); // USD / USD
            expect(result['2024-01-15'].GBP).toBeCloseTo(0.7846, 3); // 0.85338 / 1.0876
            expect(result['2024-01-15'].JPY).toBeCloseTo(147.32, 2); // 160.23 / 1.0876

            // Check that 7 follow-up days were added
            expect(result['2024-01-16']).toBeDefined();
            expect(result['2024-01-17']).toBeDefined();
            expect(result['2024-01-18']).toBeDefined();
            expect(result['2024-01-19']).toBeDefined();
            expect(result['2024-01-20']).toBeDefined();
            expect(result['2024-01-21']).toBeDefined();
            expect(result['2024-01-22']).toBeDefined();

            // Follow-up days should have same rates as the latest entry
            expect(result['2024-01-16'].USD).toBe(result['2024-01-15'].USD);
            expect(result['2024-01-16'].EUR).toBe(result['2024-01-15'].EUR);
        });

        it('should fetch and parse 90 days ECB data', async () => {
            (fetchModule.getRetry as jest.Mock).mockResolvedValue(mock90DaysXML);

            const result = await fetchEcbData(mockClock, '90days');

            expect(fetchModule.getRetry).toHaveBeenCalledWith(
                mockClock,
                'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml',
                expect.any(Object)
            );

            // Should have 3 historical dates + 7 future dates
            expect(result['2024-01-15']).toBeDefined();
            expect(result['2024-01-12']).toBeDefined();
            expect(result['2024-01-11']).toBeDefined();

            // Verify rates are converted relative to USD
            expect(result['2024-01-15'].USD).toBe(1);
            expect(result['2024-01-15'].EUR).toBeCloseTo(0.9195, 4);
            
            expect(result['2024-01-12'].USD).toBe(1);
            expect(result['2024-01-12'].EUR).toBeCloseTo(0.9182, 4);
            
            expect(result['2024-01-11'].USD).toBe(1);
            expect(result['2024-01-11'].EUR).toBeCloseTo(0.9155, 4);
        });

        it('should fetch full history ECB data', async () => {
            (fetchModule.getRetry as jest.Mock).mockResolvedValue(mock90DaysXML);

            const result = await fetchEcbData(mockClock, 'full');

            expect(fetchModule.getRetry).toHaveBeenCalledWith(
                mockClock,
                'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml',
                expect.any(Object)
            );

            expect(Object.keys(result).length).toBeGreaterThan(0);
        });

        it('should filter out dates before 2009-01-01', async () => {
            (fetchModule.getRetry as jest.Mock).mockResolvedValue(mockHistoricalXMLWithOldDates);

            const result = await fetchEcbData(mockClock, 'full');

            // 2008-12-20 should be filtered out
            expect(result['2008-12-20']).toBeUndefined();

            // 2010 dates should be included
            expect(result['2010-06-15']).toBeDefined();
            expect(result['2010-03-10']).toBeDefined();
        });

        it('should throw error when fetch fails', async () => {
            (fetchModule.getRetry as jest.Mock).mockResolvedValue(null);

            await expect(fetchEcbData(mockClock, 'daily')).rejects.toThrow(
                'Failed to fetch ECB data for duration=daily'
            );
        });

        it('should calculate correct USD-relative rates', async () => {
            (fetchModule.getRetry as jest.Mock).mockResolvedValue(mockDailyXML);

            const result = await fetchEcbData(mockClock, 'daily');
            const rates = result['2024-01-15'];

            // USD should always be 1
            expect(rates.USD).toBe(1);

            // EUR should be 1 / USD_RATE
            expect(rates.EUR).toBeCloseTo(1 / 1.0876, 4);

            // Other currencies should be their_rate / USD_RATE
            expect(rates.GBP).toBeCloseTo(0.85338 / 1.0876, 4);
            expect(rates.JPY).toBeCloseTo(160.23 / 1.0876, 4);
            expect(rates.CHF).toBeCloseTo(0.9315 / 1.0876, 4);
        });

        it('should add exactly 7 future dates based on latest entry', async () => {
            (fetchModule.getRetry as jest.Mock).mockResolvedValue(mockDailyXML);

            const result = await fetchEcbData(mockClock, 'daily');

            // Check that future dates exist
            const futureDates = [
                '2024-01-16',
                '2024-01-17',
                '2024-01-18',
                '2024-01-19',
                '2024-01-20',
                '2024-01-21',
                '2024-01-22'
            ];

            for (const date of futureDates) {
                expect(result[date]).toBeDefined();
                expect(result[date].USD).toBe(1);
                expect(result[date].EUR).toBeCloseTo(0.9195, 4);
            }
        });

        it('should handle all currencies in the response', async () => {
            (fetchModule.getRetry as jest.Mock).mockResolvedValue(mockDailyXML);

            const result = await fetchEcbData(mockClock, 'daily');
            const rates = result['2024-01-15'];

            // Verify a sample of various currencies are present
            const expectedCurrencies = [
                'USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD', 
                'CNY', 'INR', 'BRL', 'MXN', 'ZAR'
            ];

            for (const currency of expectedCurrencies) {
                expect(rates[currency]).toBeDefined();
                expect(typeof rates[currency]).toBe('number');
                expect(rates[currency]).toBeGreaterThan(0);
            }
        });
    });

    describe('fetchSupportedCurrencies', () => {
        it('should return list of supported currencies excluding time', async () => {
            (fetchModule.getRetry as jest.Mock).mockResolvedValue(mockDailyXML);

            const currencies = await fetchSupportedCurrencies(mockClock);

            expect(Array.isArray(currencies)).toBe(true);
            expect(currencies.length).toBeGreaterThan(0);
            
            // Should include major currencies
            expect(currencies).toContain('USD');
            expect(currencies).toContain('EUR');
            expect(currencies).toContain('GBP');
            expect(currencies).toContain('JPY');
            
            // Should NOT include 'time'
            expect(currencies).not.toContain('time');
        });

        it('should return all currencies from ECB response', async () => {
            (fetchModule.getRetry as jest.Mock).mockResolvedValue(mockDailyXML);

            const currencies = await fetchSupportedCurrencies(mockClock);

            // Based on our mock, we expect 31 currencies (30 + EUR, excluding time)
            expect(currencies.length).toBe(31);
        });
    });
});
