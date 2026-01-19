import { DAY_IN_MS } from "../common/date.ts";
import { getSupportedFiat } from "../api/gecko.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import { SUPPORTED_CURRENCIES_REG_KEY } from "./UsdExchangeRatesJob.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import type Job from "./Job.ts";

const key = "supported-fiat";

export class GeckoSupportedFiatJob implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    async run(): Promise<void> {
        const {data, lastUpdated} = this.register.getItemAndTimestamp(key);

        if (data && lastUpdated && (this.clock.now() - lastUpdated) < DAY_IN_MS) {
            console.log("Supported fiat currencies are up to date.");
            return;
        }

        let currencies = await getSupportedFiat();
        currencies = currencies!.map(c => c.toUpperCase());
        let ecbCurrencies = this.register.getItem(SUPPORTED_CURRENCIES_REG_KEY);
        ecbCurrencies = ecbCurrencies.map((c: string) => c.toUpperCase());
        const common = currencies.filter((c: string) => ecbCurrencies.includes(c.toUpperCase()));
        console.log(`Common supported fiat currencies: ${common.join(", ")}`);
        this.register.setItem(key, common);
    }
}