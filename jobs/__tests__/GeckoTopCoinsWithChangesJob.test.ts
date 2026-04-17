import { GeckoTopCoinsWithChangesJob } from '../GeckoTopCoinsWithChangesJob.ts';
import { InMemoryRegister } from '../../register/InMemoryRegister.ts';
import { MockClock } from '../../common/MockClock.ts';
import { HOUR_IN_MS } from '../../common/date.ts';
import * as geckoApi from '../../api/gecko.ts';

jest.mock('../../api/gecko.ts');

describe('GeckoTopCoinsWithChangesJob', () => {
    let mockClock: MockClock;
    let register: InMemoryRegister;
    let job: GeckoTopCoinsWithChangesJob;

    beforeEach(() => {
        mockClock = new MockClock(1000000000);
        register = new InMemoryRegister(mockClock);
        job = new GeckoTopCoinsWithChangesJob(register, mockClock);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('when top assets data is not in register', () => {
        it('should fetch and save top coins with changes', async () => {
            const mockCoins = [
                {
                    id: 'bitcoin',
                    symbol: 'btc',
                    name: 'Bitcoin',
                    current_price: 50000,
                    ts: 1000000000,
                    price_change_percentage_7d_in_currency: 5.2,
                },
                {
                    id: 'ethereum',
                    symbol: 'eth',
                    name: 'Ethereum',
                    current_price: 3000,
                    ts: 1000000000,
                    price_change_percentage_7d_in_currency: 3.1,
                },
            ];

            (geckoApi.getTopCoinsWithChanges as jest.Mock).mockResolvedValue(mockCoins);

            await job.run();

            expect(geckoApi.getTopCoinsWithChanges).toHaveBeenCalledWith(mockClock, 500);
            expect(geckoApi.getTopCoinsWithChanges).toHaveBeenCalledTimes(1);

            const savedCoins = register.getItem('top-assets-with-delta');
            expect(savedCoins).toEqual(mockCoins);
        });
    });

    describe('when top assets data is up to date (less than 1 hour old)', () => {
        it('should skip fetching', async () => {
            const existingCoins = [
                {
                    id: 'bitcoin',
                    symbol: 'btc',
                    name: 'Bitcoin',
                    current_price: 50000,
                    ts: 1000000000,
                },
            ];

            register.setItem('top-assets-with-delta', existingCoins);

            await job.run();

            expect(geckoApi.getTopCoinsWithChanges).not.toHaveBeenCalled();
        });
    });

    describe('when top assets data is older than 1 hour', () => {
        it('should fetch and update coins', async () => {
            const existingCoins = [
                {
                    id: 'bitcoin',
                    symbol: 'btc',
                    name: 'Bitcoin',
                    current_price: 49000,
                    ts: 900000000,
                },
            ];

            const oneHourAgoPlus = 1000000000 - HOUR_IN_MS - 1000;
            mockClock.setNow(oneHourAgoPlus);
            register.setItem('top-assets-with-delta', existingCoins);
            mockClock.setNow(1000000000);

            const newCoins = [
                {
                    id: 'bitcoin',
                    symbol: 'btc',
                    name: 'Bitcoin',
                    current_price: 50000,
                    ts: 1000000000,
                    price_change_percentage_7d_in_currency: 5.2,
                },
            ];

            (geckoApi.getTopCoinsWithChanges as jest.Mock).mockResolvedValue(newCoins);

            await job.run();

            expect(geckoApi.getTopCoinsWithChanges).toHaveBeenCalledWith(mockClock, 500);

            const savedCoins = register.getItem('top-assets-with-delta');
            expect(savedCoins).toEqual(newCoins);
        });
    });

    describe('history updates', () => {
        it('should update history with latest price point for each coin', async () => {
            const mockCoins = [
                {
                    id: 'bitcoin',
                    symbol: 'btc',
                    name: 'Bitcoin',
                    current_price: 50000,
                    ts: 1000000000,
                    price_change_percentage_7d_in_currency: 5.2,
                },
                {
                    id: 'ethereum',
                    symbol: 'eth',
                    name: 'Ethereum',
                    current_price: 3000,
                    ts: 1000000000,
                    price_change_percentage_7d_in_currency: 3.1,
                },
            ];

            (geckoApi.getTopCoinsWithChanges as jest.Mock).mockResolvedValue(mockCoins);

            await job.run();

            const bitcoinHistory = register.getItem('history/bitcoin');
            expect(bitcoinHistory).toBeDefined();
            expect(bitcoinHistory.length).toBeGreaterThan(0);
            expect(bitcoinHistory[0][0]).toBe(1000000000);
            expect(bitcoinHistory[0][1]).toBe(50000);

            const ethereumHistory = register.getItem('history/ethereum');
            expect(ethereumHistory).toBeDefined();
            expect(ethereumHistory.length).toBeGreaterThan(0);
            expect(ethereumHistory[0][0]).toBe(1000000000);
            expect(ethereumHistory[0][1]).toBe(3000);
        });

        it('should merge with existing history', async () => {
            const existingHistory = [[900000000, 48000]];
            register.setItem('history/bitcoin', existingHistory);

            const mockCoins = [
                {
                    id: 'bitcoin',
                    symbol: 'btc',
                    name: 'Bitcoin',
                    current_price: 50000,
                    ts: 1000000000,
                    price_change_percentage_7d_in_currency: 5.2,
                },
            ];

            (geckoApi.getTopCoinsWithChanges as jest.Mock).mockResolvedValue(mockCoins);

            await job.run();

            const bitcoinHistory = register.getItem('history/bitcoin');
            expect(bitcoinHistory).toBeDefined();
            expect(bitcoinHistory.length).toBe(2);
            // normaliseHistoryTuples sorts by timestamp descending
            expect(bitcoinHistory[0][0]).toBe(1000000000);
            expect(bitcoinHistory[1][0]).toBe(900000000);
        });
    });
});
