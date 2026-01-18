import { DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS, WEEK_IN_MS } from "../common/date.ts";
import { sleep } from "../common/sleep.ts";
import { getCoinsWithSparkline, history } from "../api/gecko.ts";
import { normaliseHistoryTuples } from "../common/normaliseHistoryTuples.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import { SUPPORTED_ASSETS_REG_KEY } from "./GeckoSupportedAssetsJob.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/Clock.ts";
import type Job from "./Job.ts";
import _ from "lodash"

export class LatestPricesJob implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    async run(): Promise<void> {
        const coins: Record<string, any> = this.register.getItem(SUPPORTED_ASSETS_REG_KEY);

        const coinsEntries = Object.values(coins);
        const eligibleCoinIds = coinsEntries.filter(coin => {
            const coinId = coin.id;
            const lastUpdated = this.register.getItemLastUpdated(`history/${coinId}`);
            // If never updated, include
            if (!lastUpdated) {
                return true;
            }
            if (coin.market_cap_rank <= 100 && (this.clock.now() - lastUpdated) > MINUTE_IN_MS * 5) {
                return true;
            } else if (coin.market_cap_rank <= 200 && (this.clock.now() - lastUpdated) > HOUR_IN_MS) {
                return true;
            } else if (coin.market_cap_rank <= 500 && (this.clock.now() - lastUpdated) > DAY_IN_MS) {
                return true;
            } else if ((this.clock.now() - lastUpdated) > WEEK_IN_MS) {
                return true;
            }
            return false;
        });
        const coinsWithSparkline = await getCoinsWithSparkline(eligibleCoinIds);
        for (const coin of coinsWithSparkline) {
            const coinHistory = this.register.getRegisterItem(`history/${coin.id}`) ?? [];
            const ts = coin.ts;
            const lastKnown = _.minBy(coinHistory, (h: any[]) => h[0]);
            const lastKnownTs = lastKnown ? lastKnown[0] : 0;
            // Add the last one - we know it for sure
            coinHistory.push([ts, coin.current_price, new Date(ts).toISOString()]);

            // Fill in the gaps with sparkline data
            for (let i = 0; i < coin.sparkline_in_7d.length; i++) {
                const startOfWeekTs = ts - WEEK_IN_MS;
                const perRecordOffset = WEEK_IN_MS / coin.sparkline_in_7d.length;
                const sparkTs = startOfWeekTs + (i * perRecordOffset);
                if (sparkTs > lastKnownTs && sparkTs < ts) {
                    coinHistory.push([sparkTs, coin.sparkline_in_7d[i], new Date(sparkTs).toISOString()]);
                }
            }
            this.register.setRegisterItem(`history/${coin.id}`, normaliseHistoryTuples(coinHistory, this.clock.now()));
        }
    }
}