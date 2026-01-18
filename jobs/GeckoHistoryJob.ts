import { DAY_IN_MS, MINUTE_IN_MS } from "../common/date.ts";
import { sleep } from "../common/sleep.ts";
import { history } from "../api/gecko.ts";
import { normaliseHistoryTuples } from "../common/util.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import { SUPPORTED_ASSETS_REG_KEY } from "./GeckoSupportedAssetsJob.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/Clock.ts";
import type Job from "./Job.ts";
import _ from "lodash"

export class GeckoHistoryJob implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    async run(): Promise<void> {
        const coins: Record<string, any> = this.register.getItem(SUPPORTED_ASSETS_REG_KEY);
        for (const coin of Object.values(coins)) {
            const coinKey = `history/${coin.id}`;
            const {data: currentHistory, lastUpdated} = this.register.getItemAndTimestamp(coinKey);

            const newHistoryItems: Array<[number, number]> = [];

            if (currentHistory && lastUpdated && (this.clock.now() - lastUpdated) < DAY_IN_MS * 5) {
                console.log(`History for ${coin.id} is up to date.`);
                continue
            } else if (currentHistory && lastUpdated && (this.clock.now() - lastUpdated) < 89 * DAY_IN_MS) {
                console.log(`Fetching 90 days history for ${coin.id}...`);
                const threeMonths = await history(coin.id, 90);
                // setRegisterItem(coingKey, combineHistories(currentHistory, historyData));
                newHistoryItems.push(...threeMonths);
            } else {
                console.log(`Fetching full history for ${coin.id}...`);
                const year = await history(coin.id, 365);
                newHistoryItems.push(...year);
                await sleep(0.3 * MINUTE_IN_MS);
                const threeMonths = await history(coin.id, 90);
                newHistoryItems.push(...threeMonths);
            }

            const finalHistory = [...(currentHistory || []), ...newHistoryItems];
            this.register.setItem(coinKey, normaliseHistoryTuples(finalHistory, this.clock.now()));
            await sleep(0.3 * MINUTE_IN_MS);
        }
    }
}