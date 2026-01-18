import { set } from "lodash";
import { HOUR_IN_MS } from "../common/date.ts";
import { getTopCoinsWithChanges } from "../api/gecko.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import { normaliseHistoryTuples } from "../common/normaliseHistoryTuples.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/Clock.ts";
import type Job from "./Job.ts";

const key = "top-assets-with-delta";

export class GeckoTopCoinsWithChangesJob implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    async run(): Promise<void> {
        const {data, lastUpdated} = this.register.getItemAndTimestamp(key);

        if (data && lastUpdated && (this.clock.now() - lastUpdated) < HOUR_IN_MS) {
            console.log("Supported assets with deltas are up to date.");
            return;
        }
        const updatedCoins = await getTopCoinsWithChanges(500);
        console.log(`Fetched ${Object.keys(updatedCoins).length} supported assets from Gecko.`);
        this.register.setItem(key, updatedCoins);

        // Update history with last price point, since we have it here already
        for (const coin of updatedCoins) {
            console.log(`Updating history for ${coin.id} with latest price point, while we have it...`);
            const coinHistory = this.register.getItem(`history/${coin.id}`);
            this.register.setItem(`history/${coin.id}`, normaliseHistoryTuples([
                ...(coinHistory || []),
                [coin.ts, coin.current_price, new Date(coin.ts).toISOString()],
            ], this.clock.now()));
        }
    }
}