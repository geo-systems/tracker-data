import { GeckoHistoryJob } from '../GeckoHistoryJob.ts';
import { InMemoryRegister } from '../../register/InMemoryRegister.ts';
import { MockClock } from '../../common/MockClock.ts';
import { DAY_IN_MS, MINUTE_IN_MS } from '../../common/date.ts';
import { SUPPORTED_ASSETS_REG_KEY } from '../GeckoSupportedAssetsJob.ts';
import * as geckoApi from '../../api/gecko.ts';

jest.mock('../../api/gecko.ts');

describe('GeckoHistoryJob', () => {
    let mockClock: MockClock;
    let register: InMemoryRegister;
    let job: GeckoHistoryJob;

    beforeEach(() => {
        mockClock = new MockClock(1000000000);
        register = new InMemoryRegister(mockClock);
        job = new GeckoHistoryJob(register, mockClock);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('when no coins are registered', () => {
        it('should complete without errors', async () => {
            register.setItem(SUPPORTED_ASSETS_REG_KEY, {});
            
            await job.run();
            
            expect(geckoApi.history).not.toHaveBeenCalled();
        });
    });

    describe('when history is up to date (less than 5 days old)', () => {
        it('should skip fetching', async () => {
            const coins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc' },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);
            
            const existingHistory = [[900000000, 50000], [950000000, 51000]];
            const fourDaysAgo = 1000000000 - (DAY_IN_MS * 4);
            
            mockClock.setNow(fourDaysAgo);
            register.setItem('history/bitcoin', existingHistory);
            
            mockClock.setNow(1000000000);
            
            await job.run();
            
            expect(geckoApi.history).not.toHaveBeenCalled();
        });
    });

    describe('when history is 5-89 days old', () => {
        it('should fetch 90 days history only', async () => {
            const coins = {
                ethereum: { id: 'ethereum', symbol: 'eth' },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);
            
            const existingHistory = [[800000000, 3000], [850000000, 3100]];
            const sixtyDaysAgo = 1000000000 - (DAY_IN_MS * 60);
            
            mockClock.setNow(sixtyDaysAgo);
            register.setItem('history/ethereum', existingHistory);
            
            mockClock.setNow(1000000000);
            
            const mockThreeMonthsData = [[980000000, 3500], [990000000, 3600]];
            (geckoApi.history as jest.Mock).mockResolvedValue(mockThreeMonthsData);
            
            await job.run();
            
            expect(geckoApi.history).toHaveBeenCalledTimes(1);
            expect(geckoApi.history).toHaveBeenCalledWith(mockClock, 'ethereum', 90);
            
            const savedHistory = register.getItem('history/ethereum');
            // normaliseHistoryTuples sorts by timestamp descending and adds ISO dates
            expect(savedHistory).toBeDefined();
            expect(savedHistory.length).toBe(4);
            expect(savedHistory[0][0]).toBe(990000000); // Most recent first
            expect(savedHistory[savedHistory.length - 1][0]).toBe(800000000); // Oldest last
        });
    });

    describe('when history is older than 89 days or does not exist', () => {
        it('should fetch both 365 days and 90 days history', async () => {
            const coins = {
                cardano: { id: 'cardano', symbol: 'ada' },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);
            
            const mockYearData = [[700000000, 1.0], [750000000, 1.1]];
            const mockThreeMonthsData = [[980000000, 1.5], [990000000, 1.6]];
            
            (geckoApi.history as jest.Mock)
                .mockResolvedValueOnce(mockYearData)
                .mockResolvedValueOnce(mockThreeMonthsData);
            
            await job.run();
            
            expect(geckoApi.history).toHaveBeenCalledTimes(2);
            expect(geckoApi.history).toHaveBeenNthCalledWith(1, mockClock, 'cardano', 365);
            expect(geckoApi.history).toHaveBeenNthCalledWith(2, mockClock, 'cardano', 90);
            
            expect(mockClock.sleepCalls).toContain(0.3 * MINUTE_IN_MS);
            
            const savedHistory = register.getItem('history/cardano');
            // normaliseHistoryTuples sorts by timestamp descending
            expect(savedHistory).toBeDefined();
            expect(savedHistory.length).toBe(4);
            expect(savedHistory[0][0]).toBe(990000000); // Most recent first
            expect(savedHistory[savedHistory.length - 1][0]).toBe(700000000); // Oldest last
        });

        it('should handle coin with no existing history', async () => {
            const coins = {
                polkadot: { id: 'polkadot', symbol: 'dot' },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);
            
            const mockYearData = [[700000000, 10.0]];
            const mockThreeMonthsData = [[990000000, 15.0]];
            
            (geckoApi.history as jest.Mock)
                .mockResolvedValueOnce(mockYearData)
                .mockResolvedValueOnce(mockThreeMonthsData);
            
            await job.run();
            
            expect(geckoApi.history).toHaveBeenCalledTimes(2);
            const savedHistory = register.getItem('history/polkadot');
            // normaliseHistoryTuples sorts by timestamp descending
            expect(savedHistory).toBeDefined();
            expect(savedHistory.length).toBe(2);
            expect(savedHistory[0][0]).toBe(990000000); // Most recent first
            expect(savedHistory[1][0]).toBe(700000000); // Oldest last
        });
    });

    describe('when processing multiple coins', () => {
        it('should process each coin and sleep between them', async () => {
            const coins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc' },
                ethereum: { id: 'ethereum', symbol: 'eth' },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);
            
            const mockData = [[990000000, 50000]];
            (geckoApi.history as jest.Mock).mockResolvedValue(mockData);
            
            await job.run();
            
            expect(geckoApi.history).toHaveBeenCalledTimes(4); // 2 coins * 2 calls each
            expect(mockClock.sleepCalls).toHaveLength(4); // 2 intermediate + 2 final
        });
    });

    describe('normalisation', () => {
        it('should normalise and save combined history', async () => {
            const coins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc' },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);
            
            const existingHistory = [[800000000, 45000]];
            const oldTimestamp = 1000000000 - (DAY_IN_MS * 100);
            mockClock.setNow(oldTimestamp);
            register.setItem('history/bitcoin', existingHistory);
            
            const currentTime = 2000000000;
            mockClock.setNow(currentTime);
            
            const mockYearData = [[900000000, 48000]];
            const mockThreeMonthsData = [[950000000, 49000]];
            (geckoApi.history as jest.Mock)
                .mockResolvedValueOnce(mockYearData)
                .mockResolvedValueOnce(mockThreeMonthsData);
            
            await job.run();
            
            const savedHistory = register.getItem('history/bitcoin');
            expect(savedHistory).toBeDefined();
            expect(Array.isArray(savedHistory)).toBe(true);
            expect(savedHistory.length).toBeGreaterThan(0);
        });
    });

    describe('register updates', () => {
        it('should update register timestamp when saving history', async () => {
            const coins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc' },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);
            
            const mockData = [[990000000, 50000]];
            (geckoApi.history as jest.Mock).mockResolvedValue(mockData);
            
            await job.run();
            
            const timestamp = register.getItemLastUpdated('history/bitcoin');
            expect(timestamp).toBe(1000000000);
        });
    });
});
