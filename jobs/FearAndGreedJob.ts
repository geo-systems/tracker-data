import { HOUR_IN_MS } from "../common/date.ts";
import { getFearAndGreedIndex } from "../api/fgi.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import type Job from "./Job.ts";
import { normaliseFGITuples } from "../common/normaliseHistoryTuples.ts";

export const FEAR_AND_GREED_REG_KEY = 'fear-and-greed';

export class FearAndGreedJob implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    async run(): Promise<void> {
        const {data: oldData, lastUpdated} = this.register.getItemAndTimestamp(FEAR_AND_GREED_REG_KEY);
        const now = this.clock.now();

        // Only fetch if data wasn't fetched in the last 6 hours
        if (oldData && lastUpdated && (now - lastUpdated) < HOUR_IN_MS * 6) {
            console.log(`Fear and Greed Index was updated. Skipping fetch.`);
            return;
        }

        console.log(`Fetching Fear and Greed Index data...`);
        const rawData = await getFearAndGreedIndex();
        const data = normaliseFGITuples([...(oldData ?? []), ...rawData], now);
        
        this.register.setItem(FEAR_AND_GREED_REG_KEY, data);
        console.log(`Fear and Greed Index data fetched successfully. Total records: ${data.length}`);
    }
}

new FearAndGreedJob().run();
