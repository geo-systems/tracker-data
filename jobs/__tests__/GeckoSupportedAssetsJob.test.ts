import { GeckoSupportedAssetsJob, SUPPORTED_ASSETS_REG_KEY } from '../GeckoSupportedAssetsJob.ts';
import { InMemoryRegister } from '../../register/InMemoryRegister.ts';
import { MockClock } from '../../common/MockClock.ts';
import { DAY_IN_MS } from '../../common/date.ts';
import * as geckoApi from '../../api/gecko.ts';

jest.mock('../../api/gecko.ts');

describe('GeckoSupportedAssetsJob', () => {
    let mockClock: MockClock;
    let register: InMemoryRegister;
    let job: GeckoSupportedAssetsJob;

    beforeEach(() => {
        mockClock = new MockClock(1000000000);
        register = new InMemoryRegister(mockClock);
        job = new GeckoSupportedAssetsJob(register, mockClock);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('when supported assets are not in register', () => {
        it('should fetch and save supported coins', async () => {
            const mockCoins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
                ethereum: { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
            };

            (geckoApi.getSupportedCoins as jest.Mock).mockResolvedValue(mockCoins);

            await job.run();

            expect(geckoApi.getSupportedCoins).toHaveBeenCalledWith(mockClock);
            expect(geckoApi.getSupportedCoins).toHaveBeenCalledTimes(1);

            const savedCoins = register.getItem(SUPPORTED_ASSETS_REG_KEY);
            expect(savedCoins).toEqual(mockCoins);
            expect(register.getItemLastUpdated(SUPPORTED_ASSETS_REG_KEY)).toBe(1000000000);
        });
    });

    describe('when supported assets are up to date (less than 1 day old)', () => {
        it('should skip fetching', async () => {
            const existingCoins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
            };

            register.setItem(SUPPORTED_ASSETS_REG_KEY, existingCoins);

            await job.run();

            expect(geckoApi.getSupportedCoins).not.toHaveBeenCalled();
        });
    });

    describe('when supported assets are older than 1 day', () => {
        it('should fetch and merge with existing coins', async () => {
            const existingCoins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
            };

            const oneDayAgoPlus = 1000000000 - DAY_IN_MS - 1000;
            mockClock.setNow(oneDayAgoPlus);
            register.setItem(SUPPORTED_ASSETS_REG_KEY, existingCoins);
            mockClock.setNow(1000000000);

            const newCoins = {
                ethereum: { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                cardano: { id: 'cardano', symbol: 'ada', name: 'Cardano' },
            };

            (geckoApi.getSupportedCoins as jest.Mock).mockResolvedValue(newCoins);

            await job.run();

            expect(geckoApi.getSupportedCoins).toHaveBeenCalledWith(mockClock);

            const savedCoins = register.getItem(SUPPORTED_ASSETS_REG_KEY);
            expect(savedCoins).toEqual({
                bitcoin: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
                ethereum: { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                cardano: { id: 'cardano', symbol: 'ada', name: 'Cardano' },
            });
        });

        it('should update existing coins with new data', async () => {
            const existingCoins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', market_cap: 1000 },
            };

            const oneDayAgoPlus = 1000000000 - DAY_IN_MS - 1000;
            mockClock.setNow(oneDayAgoPlus);
            register.setItem(SUPPORTED_ASSETS_REG_KEY, existingCoins);
            mockClock.setNow(1000000000);

            const updatedCoins = {
                bitcoin: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', market_cap: 2000 },
            };

            (geckoApi.getSupportedCoins as jest.Mock).mockResolvedValue(updatedCoins);

            await job.run();

            const savedCoins = register.getItem(SUPPORTED_ASSETS_REG_KEY);
            expect(savedCoins.bitcoin.market_cap).toBe(2000);
        });
    });
});
