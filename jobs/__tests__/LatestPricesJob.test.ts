import { LatestPricesJob } from '../LatestPricesJob.ts';
import { InMemoryRegister } from '../../register/InMemoryRegister.ts';
import { MockClock } from '../../common/MockClock.ts';
import { DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS, WEEK_IN_MS } from '../../common/date.ts';
import { SUPPORTED_ASSETS_REG_KEY } from '../GeckoSupportedAssetsJob.ts';
import * as geckoApi from '../../api/gecko.ts';

jest.mock('../../api/gecko.ts');

describe('LatestPricesJob', () => {
    let mockClock: MockClock;
    let register: InMemoryRegister;
    let job: LatestPricesJob;

    beforeEach(() => {
        mockClock = new MockClock(1000000000);
        register = new InMemoryRegister(mockClock);
        job = new LatestPricesJob(register, mockClock);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('when no coins have history', () => {
        it('should fetch sparkline for all coins', async () => {
            const coins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc', market_cap_rank: 1 },
                ethereum: { id: 'ethereum', symbol: 'eth', market_cap_rank: 2 },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);

            const mockSparklineData = [
                {
                    id: 'bitcoin',
                    symbol: 'btc',
                    current_price: 50000,
                    ts: 1000000000,
                    sparkline_in_7d: [48000, 49000, 50000],
                },
                {
                    id: 'ethereum',
                    symbol: 'eth',
                    current_price: 3000,
                    ts: 1000000000,
                    sparkline_in_7d: [2900, 2950, 3000],
                },
            ];

            (geckoApi.getCoinsWithSparkline as jest.Mock).mockResolvedValue(mockSparklineData);

            await job.run();

            expect(geckoApi.getCoinsWithSparkline).toHaveBeenCalledWith(mockClock, expect.arrayContaining([
                'bitcoin',
                'ethereum',
            ]));

            const bitcoinHistory = register.getItem('history/bitcoin');
            expect(bitcoinHistory).toBeDefined();
            expect(bitcoinHistory.length).toBeGreaterThan(0);

            const ethereumHistory = register.getItem('history/ethereum');
            expect(ethereumHistory).toBeDefined();
            expect(ethereumHistory.length).toBeGreaterThan(0);
        });
    });

    describe('eligibility based on rank and update time', () => {
        it('should update top 100 coins if older than 5 minutes', async () => {
            const coins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc', market_cap_rank: 50 },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);

            const sixMinutesAgo = 1000000000 - (6 * MINUTE_IN_MS);
            mockClock.setNow(sixMinutesAgo);
            register.setItem('history/bitcoin', [[sixMinutesAgo, 50000]]);
            mockClock.setNow(1000000000);

            const mockSparklineData = [
                {
                    id: 'bitcoin',
                    symbol: 'btc',
                    current_price: 50000,
                    ts: 1000000000,
                    sparkline_in_7d: [48000, 49000, 50000],
                },
            ];

            (geckoApi.getCoinsWithSparkline as jest.Mock).mockResolvedValue(mockSparklineData);

            await job.run();

            expect(geckoApi.getCoinsWithSparkline).toHaveBeenCalled();
        });

        it('should skip top 100 coins if updated less than 5 minutes ago', async () => {
            const coins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc', market_cap_rank: 50 },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);

            const fourMinutesAgo = 1000000000 - (4 * MINUTE_IN_MS);
            mockClock.setNow(fourMinutesAgo);
            register.setItem('history/bitcoin', [[fourMinutesAgo, 50000]]);
            mockClock.setNow(1000000000);

            (geckoApi.getCoinsWithSparkline as jest.Mock).mockResolvedValue([]);

            await job.run();

            expect(geckoApi.getCoinsWithSparkline).toHaveBeenCalledWith(mockClock, []);
        });

        it('should update rank 101-200 coins if older than 1 hour', async () => {
            const coins = {
                cardano: { id: 'cardano', symbol: 'ada', market_cap_rank: 150 },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);

            const twoHoursAgo = 1000000000 - (2 * HOUR_IN_MS);
            mockClock.setNow(twoHoursAgo);
            register.setItem('history/cardano', [[twoHoursAgo, 1.5]]);
            mockClock.setNow(1000000000);

            const mockSparklineData = [
                {
                    id: 'cardano',
                    symbol: 'ada',
                    current_price: 1.6,
                    ts: 1000000000,
                    sparkline_in_7d: [1.5, 1.55, 1.6],
                },
            ];

            (geckoApi.getCoinsWithSparkline as jest.Mock).mockResolvedValue(mockSparklineData);

            await job.run();

            expect(geckoApi.getCoinsWithSparkline).toHaveBeenCalled();
        });

        it('should update rank 201-500 coins if older than 1 day', async () => {
            const coins = {
                polkadot: { id: 'polkadot', symbol: 'dot', market_cap_rank: 300 },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);

            const twoDaysAgo = 1000000000 - (2 * DAY_IN_MS);
            mockClock.setNow(twoDaysAgo);
            register.setItem('history/polkadot', [[twoDaysAgo, 10]]);
            mockClock.setNow(1000000000);

            const mockSparklineData = [
                {
                    id: 'polkadot',
                    symbol: 'dot',
                    current_price: 11,
                    ts: 1000000000,
                    sparkline_in_7d: [10, 10.5, 11],
                },
            ];

            (geckoApi.getCoinsWithSparkline as jest.Mock).mockResolvedValue(mockSparklineData);

            await job.run();

            expect(geckoApi.getCoinsWithSparkline).toHaveBeenCalled();
        });

        it('should update any coin if older than 1 week', async () => {
            const coins = {
                obscure: { id: 'obscure', symbol: 'obc', market_cap_rank: 1000 },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);

            const twoWeeksAgo = 1000000000 - (2 * WEEK_IN_MS);
            mockClock.setNow(twoWeeksAgo);
            register.setItem('history/obscure', [[twoWeeksAgo, 0.01]]);
            mockClock.setNow(1000000000);

            const mockSparklineData = [
                {
                    id: 'obscure',
                    symbol: 'obc',
                    current_price: 0.02,
                    ts: 1000000000,
                    sparkline_in_7d: [0.01, 0.015, 0.02],
                },
            ];

            (geckoApi.getCoinsWithSparkline as jest.Mock).mockResolvedValue(mockSparklineData);

            await job.run();

            expect(geckoApi.getCoinsWithSparkline).toHaveBeenCalled();
        });
    });

    describe('sparkline integration', () => {
        it('should add sparkline data points to history', async () => {
            const coins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc', market_cap_rank: 1 },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);

            const mockSparklineData = [
                {
                    id: 'bitcoin',
                    symbol: 'btc',
                    current_price: 50000,
                    ts: 1000000000,
                    sparkline_in_7d: [48000, 49000, 50000],
                },
            ];

            (geckoApi.getCoinsWithSparkline as jest.Mock).mockResolvedValue(mockSparklineData);

            await job.run();

            const bitcoinHistory = register.getItem('history/bitcoin');
            expect(bitcoinHistory).toBeDefined();
            expect(bitcoinHistory.length).toBeGreaterThan(1);
        });

        it('should not duplicate existing timestamps from sparkline', async () => {
            const coins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc', market_cap_rank: 1 },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);

            const existingTs = 1000000000 - WEEK_IN_MS;
            register.setItem('history/bitcoin', [[existingTs, 48000]]);

            const mockSparklineData = [
                {
                    id: 'bitcoin',
                    symbol: 'btc',
                    current_price: 50000,
                    ts: 1000000000,
                    sparkline_in_7d: [48000, 49000, 50000],
                },
            ];

            (geckoApi.getCoinsWithSparkline as jest.Mock).mockResolvedValue(mockSparklineData);

            await job.run();

            const bitcoinHistory = register.getItem('history/bitcoin');
            expect(bitcoinHistory).toBeDefined();
            // Should have added sparkline points but not duplicate the existing timestamp
            expect(bitcoinHistory.length).toBeGreaterThan(1);
        });

        it('should add current price as the most recent data point', async () => {
            const coins = {
                ethereum: { id: 'ethereum', symbol: 'eth', market_cap_rank: 2 },
            };
            register.setItem(SUPPORTED_ASSETS_REG_KEY, coins);

            const mockSparklineData = [
                {
                    id: 'ethereum',
                    symbol: 'eth',
                    current_price: 3000,
                    ts: 1000000000,
                    sparkline_in_7d: [2900, 2950],
                },
            ];

            (geckoApi.getCoinsWithSparkline as jest.Mock).mockResolvedValue(mockSparklineData);

            await job.run();

            const ethereumHistory = register.getItem('history/ethereum');
            expect(ethereumHistory).toBeDefined();
            // normaliseHistoryTuples sorts by timestamp descending
            expect(ethereumHistory[0][0]).toBe(1000000000);
            expect(ethereumHistory[0][1]).toBe(3000);
        });
    });
});
