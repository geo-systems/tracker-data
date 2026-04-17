import { HOUR_IN_MS } from "../common/date.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import type Job from "./Job.ts";
import { fetchNews } from "../api/gemini.ts";

export const NEWS_GEO_REG_KEY = 'news/geopolitical';

export class NewsGeopoliticalJob implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    async run(): Promise<void> {
        const {data: oldData, lastUpdated} = this.register.getItemAndTimestamp(NEWS_GEO_REG_KEY);
        const now = this.clock.now();

        // Only fetch if data wasn't fetched in the last N hours
        if (oldData && lastUpdated && (now - lastUpdated) < HOUR_IN_MS * 14) {
            console.log(`News Geopolitical data was updated. Skipping fetch.`);
            return;
        }

        console.log(`Fetching News Geopolitical data...`);
        let news = await fetchNews({
            prompt: "Latest news on geopolitical events and international relations, which may affect financial markets and cryptocurrencies",
            sources: "reputable geopolitical and international news sources like BBC, Al Jazeera, Reuters, The Guardian, ABC, Foreign Affairs etc"
        });
        news = (news.length === 0 ? oldData : news) ?? [];
        
        this.register.setItem(NEWS_GEO_REG_KEY, news);
        console.log(`News Geopolitical data fetched successfully`);
    }
}

