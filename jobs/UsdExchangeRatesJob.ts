import _ from "lodash";
import { DAY_IN_MS, HOUR_IN_MS } from "../common/date.ts";
import { fetchEcbData, fetchSupportedCurrencies } from "../api/ecb.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import type Job from "./Job.ts";

const key = "usd-exchange-rates";
export const SUPPORTED_CURRENCIES_REG_KEY = `${key}/supported_currencies`;

type Duration = 'full' | '90days' | 'daily' | null;

export class UsdExchangeRatesJob implements Job {
    private readonly key = "usd-exchange-rates";
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    private getDuration(lastUpdated: number | null): Duration {
        const now = this.clock.now();
        // console.log({ lastUpdated, now, delta: lastUpdated ? now - lastUpdated : null });
        if (lastUpdated && (now - lastUpdated) < HOUR_IN_MS) {
            return null;
        } else if (!lastUpdated || now - lastUpdated >= 30 * DAY_IN_MS) {
            return "full";
        } else if (now - lastUpdated >= DAY_IN_MS) {
            return "90days";
        } else {
            return "daily";
        }
    }

    async run(): Promise<void> {
        const currencies = await fetchSupportedCurrencies(this.clock);

        const { lastUpdated } = this.register.getItemAndTimestamp(this.key);
        const duration = this.getDuration(lastUpdated);
        if (!duration) {
            console.log("USD exchange rates are up to date.");
            return;
        }

        const update = await fetchEcbData(this.clock, duration);
        console.log(`Updating USD exchange rates with ${duration} data.`);
        this.register.setItem(`${this.key}/supported_currencies`, currencies);
        for (const currency of currencies) {
            let { data: currencyData } = this.register.getItemAndTimestamp(`${this.key}/${currency}`);
            let currencyUpdate = _.mapValues(update, (entry: any) => entry[currency]);
            this.register.setItem(`${this.key}/${currency}`, { ...currencyData, ...currencyUpdate });
        }
        // just to update the timestamp
        this.register.setItem(this.key);
    }
}



