import { DAY_IN_MS, MINUTE_IN_MS } from "../common/date.ts";
import { history } from "../api/gecko.ts";
import { normaliseHistoryTuples } from "../common/normaliseHistoryTuples.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import { SUPPORTED_ASSETS_REG_KEY } from "./GeckoSupportedAssetsJob.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import type Job from "./Job.ts";

export class GeckoHistoryJob implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    async run(): Promise<void> {
        const coins: Record<string, any> = this.register.getItem(SUPPORTED_ASSETS_REG_KEY);
        const startAt = this.clock.now();
        for (const coin of Object.values(coins)) {
            if (this.clock.now() - startAt > MINUTE_IN_MS * 15) {
                console.log(`Stopping history fetch to avoid running over 15 minutes.`);
                break;
            }

            const coinKey = `history/${coin.id}`;
            const {data: currentHistory, lastUpdated} = this.register.getItemAndTimestamp(coinKey);

            const newHistoryItems: Array<[number, number]> = [];
            const now = this.clock.now();

            if (currentHistory && lastUpdated && (now - lastUpdated) < DAY_IN_MS * 5) {
                console.log(`History for ${coin.id} is up to date.`);
                continue
            } else if (currentHistory && lastUpdated && (now - lastUpdated) < 89 * DAY_IN_MS) {
                console.log(`Fetching 90 days history for ${coin.id}...`);
                const threeMonths = await history(this.clock, coin.id, 90);
                // setRegisterItem(coingKey, combineHistories(currentHistory, historyData));
                newHistoryItems.push(...threeMonths);
            } else {
                console.log(`Fetching full history for ${coin.id}...`);
                const year = await history(this.clock, coin.id, 365);
                newHistoryItems.push(...year);
                await this.clock.sleep(0.3 * MINUTE_IN_MS);
                const threeMonths = await history(this.clock, coin.id, 90);
                newHistoryItems.push(...threeMonths);
            }

            const finalHistory = [...(currentHistory || []), ...newHistoryItems];
            this.register.setItem(coinKey, normaliseHistoryTuples(finalHistory, now));
            await this.clock.sleep(0.3 * MINUTE_IN_MS);
        }
    }
}