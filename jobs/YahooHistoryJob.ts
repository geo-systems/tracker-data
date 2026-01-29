import _ from "lodash"

import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import { SUPPORTED_ASSETS_REG_KEY } from "./GeckoSupportedAssetsJob.ts";
import { DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS } from "../common/date.ts";
import { getYahooHistory } from "../api/yahoo.ts";
import { normaliseHistoryTuples } from "../common/normaliseHistoryTuples.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import type Job from "./Job.ts";

export class YahooHistoryJob implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    async run(): Promise<void> {
        const startAt = this.clock.now();
        // Use chart: https://jsr.io/@gadicc/yahoo-finance2/doc/modules/chart#example_4
        const coins: Record<string, any> = this.register.getItem(SUPPORTED_ASSETS_REG_KEY);
        for (const coin of Object.values(coins)) {
            if (this.clock.now() - startAt > MINUTE_IN_MS * 10) {
                console.log(`Stopping history fetch to avoid running over 10 minutes.`);
                break;
            }


            const coinKey = `history/${coin.id}`;
            const currentHistory = this.register.getItem(coinKey);
            const timestamps = currentHistory.map((item: any) => item[0]);
            const lastHistoryItemTs: number = _.max(timestamps) ?? 0;

            const coinYahooKey = `history/yahoo/${coin.id}`;
            const lastUpdated = this.register.getItemLastUpdated(coinYahooKey);
            const newHistoryItems: Array<[number, number, string]> = [];

            // If we updated recently enough, skip
            if (lastUpdated) {
                if (this.clock.now() - lastHistoryItemTs < 5 * DAY_IN_MS) {
                    console.log(`History for ${coin.id} is up to date.`);
                    continue;
                } 
        
                if (lastUpdated && (this.clock.now() - lastUpdated) < 8 * DAY_IN_MS) {
                    console.log(`History for ${coin.id} is up to date.`);
                    continue;
                } 
            } else if (coin.rank > 500) {
                console.log(`Fetching full Yahoo history for ${coin.id}...`);
                const full = await getYahooHistory(coin.symbol, '1d', undefined, undefined, this.clock);
                newHistoryItems.push(...full);
                const fewMonths = await getYahooHistory(coin.symbol, '1h', 30, undefined, this.clock);
                newHistoryItems.push(...fewMonths);

                // Mark it as updated
                this.register.setItem(coinYahooKey);
                if (newHistoryItems.length > 0) {
                    const finalHistory = [...(currentHistory || []), ...newHistoryItems];
                    this.register.setItem(coinKey, normaliseHistoryTuples(finalHistory, this.clock.now()));
                }
            }

        }
    }
}