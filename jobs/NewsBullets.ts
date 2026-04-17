import { HOUR_IN_MS } from "../common/date.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import type Job from "./Job.ts";
import { fetchNewsBullets } from "../api/gemini.ts";

export const NEWS_CRYPTO_BULLETS_REG_KEY = 'news/bullets';

export class NewsBullets implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    async run(): Promise<void> {
        const {data: oldData, lastUpdated} = this.register.getItemAndTimestamp(NEWS_CRYPTO_BULLETS_REG_KEY);
        const now = this.clock.now();

        // Only fetch if data wasn't fetched in the last N hours
        if (oldData && lastUpdated && (now - lastUpdated) < HOUR_IN_MS * 9) {
            console.log(`News Crypto bullets data was updated. Skipping fetch.`);
            return;
        }

        console.log(`Fetching News Crypto bullets data...`);
        let news = await fetchNewsBullets();
        news = (news.length === 0 ? oldData : news) ?? [];
        
        this.register.setItem(NEWS_CRYPTO_BULLETS_REG_KEY, news);
        console.log(`News Crypto bullets data fetched successfully`);
    }
}
