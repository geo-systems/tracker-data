import { GeckoSupportedFiatJob } from '../GeckoSupportedFiatJob.ts';
import { InMemoryRegister } from '../../register/InMemoryRegister.ts';
import { MockClock } from '../../common/MockClock.ts';
import { DAY_IN_MS } from '../../common/date.ts';
import { SUPPORTED_CURRENCIES_REG_KEY } from '../UsdExchangeRatesJob.ts';
import * as geckoApi from '../../api/gecko.ts';

jest.mock('../../api/gecko.ts');

describe('GeckoSupportedFiatJob', () => {
    let mockClock: MockClock;
    let register: InMemoryRegister;
    let job: GeckoSupportedFiatJob;

    beforeEach(() => {
        mockClock = new MockClock(1000000000);
        register = new InMemoryRegister(mockClock);
        job = new GeckoSupportedFiatJob(register, mockClock);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('when supported fiat is not in register', () => {
        it('should fetch and save common currencies', async () => {
            const geckoFiat = ['usd', 'eur', 'gbp', 'jpy'];
            const ecbCurrencies = ['USD', 'EUR', 'GBP', 'CHF'];
            
            register.setItem(SUPPORTED_CURRENCIES_REG_KEY, ecbCurrencies);
            (geckoApi.getSupportedFiat as jest.Mock).mockResolvedValue(geckoFiat);

            await job.run();

            expect(geckoApi.getSupportedFiat).toHaveBeenCalled();

            const savedFiat = register.getItem('supported-fiat');
            expect(savedFiat).toEqual(['USD', 'EUR', 'GBP']);
            expect(savedFiat).not.toContain('JPY');
            expect(savedFiat).not.toContain('CHF');
        });
    });

    describe('when supported fiat is up to date (less than 1 day old)', () => {
        it('should skip fetching', async () => {
            const existingFiat = ['USD', 'EUR', 'GBP'];
            register.setItem('supported-fiat', existingFiat);

            await job.run();

            expect(geckoApi.getSupportedFiat).not.toHaveBeenCalled();
        });
    });

    describe('when supported fiat is older than 1 day', () => {
        it('should fetch and update currencies', async () => {
            const existingFiat = ['USD', 'EUR'];

            const oneDayAgoPlus = 1000000000 - DAY_IN_MS - 1000;
            mockClock.setNow(oneDayAgoPlus);
            register.setItem('supported-fiat', existingFiat);
            mockClock.setNow(1000000000);

            const geckoFiat = ['usd', 'eur', 'gbp', 'cad'];
            const ecbCurrencies = ['USD', 'EUR', 'GBP', 'JPY'];
            
            register.setItem(SUPPORTED_CURRENCIES_REG_KEY, ecbCurrencies);
            (geckoApi.getSupportedFiat as jest.Mock).mockResolvedValue(geckoFiat);

            await job.run();

            expect(geckoApi.getSupportedFiat).toHaveBeenCalled();

            const savedFiat = register.getItem('supported-fiat');
            expect(savedFiat).toEqual(['USD', 'EUR', 'GBP']);
        });
    });

    describe('currency filtering', () => {
        it('should only keep currencies supported by both Gecko and ECB', async () => {
            const geckoFiat = ['usd', 'eur', 'gbp', 'btc', 'eth'];
            const ecbCurrencies = ['USD', 'EUR', 'CHF', 'JPY'];
            
            register.setItem(SUPPORTED_CURRENCIES_REG_KEY, ecbCurrencies);
            (geckoApi.getSupportedFiat as jest.Mock).mockResolvedValue(geckoFiat);

            await job.run();

            const savedFiat = register.getItem('supported-fiat');
            expect(savedFiat).toEqual(['USD', 'EUR']);
            expect(savedFiat).not.toContain('BTC');
            expect(savedFiat).not.toContain('ETH');
            expect(savedFiat).not.toContain('CHF');
            expect(savedFiat).not.toContain('JPY');
            expect(savedFiat).not.toContain('GBP');
        });

        it('should handle case-insensitive matching', async () => {
            const geckoFiat = ['usd', 'eur'];
            const ecbCurrencies = ['USD', 'EUR'];
            
            register.setItem(SUPPORTED_CURRENCIES_REG_KEY, ecbCurrencies);
            (geckoApi.getSupportedFiat as jest.Mock).mockResolvedValue(geckoFiat);

            await job.run();

            const savedFiat = register.getItem('supported-fiat');
            expect(savedFiat).toEqual(['USD', 'EUR']);
        });
    });
});
