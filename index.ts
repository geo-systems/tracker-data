import fs from 'fs';
import { UsdExchangeRatesJob } from './jobs/UsdExchangeRatesJob.ts';
import { GeckoSupportedFiatJob } from './jobs/GeckoSupportedFiatJob.ts';
import { GeckoSupportedAssetsJob } from './jobs/GeckoSupportedAssetsJob.ts';
import { GeckoHistoryJob } from './jobs/GeckoHistoryJob.ts';
import { YahooHistoryJob } from './jobs/YahooHistoryJob.ts';
import { LatestPricesJob } from './jobs/LatestPricesJob.ts';
import type Job from './jobs/Job.ts';
import { MINUTE_IN_MS } from './common/date.ts';
import { GeckoTopCoinsWithChangesJob } from './jobs/GeckoTopCoinsWithChangesJob.ts';
import { FearAndGreedJob } from './jobs/FearAndGreedJob.ts';


interface JobEntry {
    name: string;
    job: Job;
    failOnError?: boolean;
}

const jobs: JobEntry[] = [
    { name: 'Exchange Rates', job: new UsdExchangeRatesJob(), failOnError: false },
    { name: 'Supported Fiat Currencies', job: new GeckoSupportedFiatJob(), failOnError: false },
    { name: 'Supported Assets', job: new GeckoSupportedAssetsJob(), failOnError: true },
    { name: 'Gecko History', job: new GeckoHistoryJob(), failOnError: true },
    { name: 'Yahoo History', job: new YahooHistoryJob(), failOnError: false },
    { name: 'Latest Prices', job: new LatestPricesJob(), failOnError: true },
    { name: 'Top Coins', job: new GeckoTopCoinsWithChangesJob(), failOnError: false },
    { name: 'Supported Fiat', job: new GeckoSupportedFiatJob(), failOnError: false },
    { name: 'Fear and Greed Index', job: new FearAndGreedJob(), failOnError: false },
];

export const runJobs = async () => {
    for (const jobEntry of jobs) {
        const startTime = Date.now();
        console.log(`============================= Starting job: ${jobEntry.name} =============================`);
        try {
            await jobEntry.job.run();
            const endTime = Date.now();
            console.log(`Completed job: ${jobEntry.name} in ${Math.round((endTime - startTime) / MINUTE_IN_MS)} minutes`);
        } catch (error) {
            console.error(`Error in job ${jobEntry.name}:`, error);
            if (jobEntry.failOnError) {
                console.error(`Job ${jobEntry.name} failed and is marked as failOnError. Stopping further execution.`);
                process.exit(1);
            }
        }
    }
    console.log('All jobs completed.');
}

await runJobs();