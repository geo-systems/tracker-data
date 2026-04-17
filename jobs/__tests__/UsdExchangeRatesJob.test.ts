import { UsdExchangeRatesJob, SUPPORTED_CURRENCIES_REG_KEY } from '../UsdExchangeRatesJob.ts';
import { InMemoryRegister } from '../../register/InMemoryRegister.ts';
import { MockClock } from '../../common/MockClock.ts';
import { DAY_IN_MS, HOUR_IN_MS } from '../../common/date.ts';
import * as ecbApi from '../../api/ecb.ts';

jest.mock('../../api/ecb.ts');

describe('UsdExchangeRatesJob', () => {
    let mockClock: MockClock;
    let register: InMemoryRegister;
    let job: UsdExchangeRatesJob;

    beforeEach(() => {
        mockClock = new MockClock(1000000000);
        register = new InMemoryRegister(mockClock);
        job = new UsdExchangeRatesJob(register, mockClock);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('when exchange rates are not in register', () => {
        it('should fetch full history', async () => {
            const mockCurrencies = ['USD', 'EUR', 'GBP'];
            const mockData = {
                '2024-01-01': { USD: 1, EUR: 0.92, GBP: 0.78 },
                '2024-01-02': { USD: 1, EUR: 0.93, GBP: 0.79 },
            };

            (ecbApi.fetchSupportedCurrencies as jest.Mock).mockResolvedValue(mockCurrencies);
            (ecbApi.fetchEcbData as jest.Mock).mockResolvedValue(mockData);

            await job.run();

            expect(ecbApi.fetchSupportedCurrencies).toHaveBeenCalledWith(mockClock);
            expect(ecbApi.fetchEcbData).toHaveBeenCalledWith(mockClock, 'full');

            const savedCurrencies = register.getItem(SUPPORTED_CURRENCIES_REG_KEY);
            expect(savedCurrencies).toEqual(mockCurrencies);

            const usdRates = register.getItem('usd-exchange-rates/USD');
            expect(usdRates).toEqual({
                '2024-01-01': 1,
                '2024-01-02': 1,
            });

            const eurRates = register.getItem('usd-exchange-rates/EUR');
            expect(eurRates).toEqual({
                '2024-01-01': 0.92,
                '2024-01-02': 0.93,
            });
        });
    });

    describe('when exchange rates are up to date (less than 1 hour old)', () => {
        it('should skip fetching', async () => {
            register.setItem('usd-exchange-rates');

            await job.run();

            expect(ecbApi.fetchSupportedCurrencies).toHaveBeenCalled();
            expect(ecbApi.fetchEcbData).not.toHaveBeenCalled();
        });
    });

    describe('when exchange rates are 1 hour to 1 day old', () => {
        it('should fetch daily data', async () => {
            const oneHourAgoPlus = 1000000000 - HOUR_IN_MS - 1000;
            mockClock.setNow(oneHourAgoPlus);
            register.setItem('usd-exchange-rates');
            mockClock.setNow(1000000000);

            const mockCurrencies = ['USD', 'EUR'];
            const mockData = {
                '2024-01-03': { USD: 1, EUR: 0.94 },
            };

            (ecbApi.fetchSupportedCurrencies as jest.Mock).mockResolvedValue(mockCurrencies);
            (ecbApi.fetchEcbData as jest.Mock).mockResolvedValue(mockData);

            await job.run();

            expect(ecbApi.fetchEcbData).toHaveBeenCalledWith(mockClock, 'daily');
        });
    });

    describe('when exchange rates are 1 day to 30 days old', () => {
        it('should fetch 90 days data', async () => {
            const twoDaysAgo = 1000000000 - (2 * DAY_IN_MS);
            mockClock.setNow(twoDaysAgo);
            register.setItem('usd-exchange-rates');
            mockClock.setNow(1000000000);

            const mockCurrencies = ['USD', 'EUR'];
            const mockData = {
                '2024-01-03': { USD: 1, EUR: 0.94 },
            };

            (ecbApi.fetchSupportedCurrencies as jest.Mock).mockResolvedValue(mockCurrencies);
            (ecbApi.fetchEcbData as jest.Mock).mockResolvedValue(mockData);

            await job.run();

            expect(ecbApi.fetchEcbData).toHaveBeenCalledWith(mockClock, '90days');
        });
    });

    describe('when exchange rates are older than 30 days', () => {
        it('should fetch full data', async () => {
            const thirtyOneDaysAgo = 1000000000 - (31 * DAY_IN_MS);
            mockClock.setNow(thirtyOneDaysAgo);
            register.setItem('usd-exchange-rates');
            mockClock.setNow(1000000000);

            const mockCurrencies = ['USD', 'EUR'];
            const mockData = {
                '2024-01-03': { USD: 1, EUR: 0.94 },
            };

            (ecbApi.fetchSupportedCurrencies as jest.Mock).mockResolvedValue(mockCurrencies);
            (ecbApi.fetchEcbData as jest.Mock).mockResolvedValue(mockData);

            await job.run();

            expect(ecbApi.fetchEcbData).toHaveBeenCalledWith(mockClock, 'full');
        });
    });

    describe('merging with existing data', () => {
        it('should merge new rates with existing rates', async () => {
            const existingEurRates = {
                '2024-01-01': 0.92,
            };
            register.setItem('usd-exchange-rates/EUR', existingEurRates);

            const twoDaysAgo = 1000000000 - (2 * DAY_IN_MS);
            mockClock.setNow(twoDaysAgo);
            register.setItem('usd-exchange-rates');
            mockClock.setNow(1000000000);

            const mockCurrencies = ['EUR'];
            const mockData = {
                '2024-01-02': { EUR: 0.93 },
                '2024-01-03': { EUR: 0.94 },
            };

            (ecbApi.fetchSupportedCurrencies as jest.Mock).mockResolvedValue(mockCurrencies);
            (ecbApi.fetchEcbData as jest.Mock).mockResolvedValue(mockData);

            await job.run();

            const eurRates = register.getItem('usd-exchange-rates/EUR');
            expect(eurRates).toEqual({
                '2024-01-01': 0.92,
                '2024-01-02': 0.93,
                '2024-01-03': 0.94,
            });
        });
    });

    describe('timestamp updates', () => {
        it('should update the main key timestamp', async () => {
            const twoDaysAgo = 1000000000 - (2 * DAY_IN_MS);
            mockClock.setNow(twoDaysAgo);
            register.setItem('usd-exchange-rates');
            mockClock.setNow(1000000000);

            const mockCurrencies = ['USD'];
            const mockData = {
                '2024-01-03': { USD: 1 },
            };

            (ecbApi.fetchSupportedCurrencies as jest.Mock).mockResolvedValue(mockCurrencies);
            (ecbApi.fetchEcbData as jest.Mock).mockResolvedValue(mockData);

            await job.run();

            const timestamp = register.getItemLastUpdated('usd-exchange-rates');
            expect(timestamp).toBe(1000000000);
        });
    });
});
