import fs from 'fs';
import { run as loadExchangeRates } from './jobs/usdExchangeRates.ts';
import { run as loadSupportedFiat } from './jobs/geckoSupportedFiat.ts';
import { run as loadSupportedAssets } from './jobs/geckoSupportedAssets.ts';
import { run as loadGeckoHistory } from './jobs/geckoHistory.ts';
import { run as loadYahooHistory } from './jobs/yahooHistory.ts';
import { run as latestPrices } from './jobs/latestPrices.ts';
import { MINUTE_IN_MS } from './api/date.ts';


interface Job {
    name: string;
    run: () => Promise<void>;
    failOnError?: boolean;
}

const jobs: Job[] = [
    { name: 'Exchange Rates', run: loadExchangeRates, failOnError: false },
    { name: 'Supported Fiat Currencies', run: loadSupportedFiat, failOnError: false },
    { name: 'Supported Assets', run: loadSupportedAssets, failOnError: true },
    { name: 'Gecko History', run: loadGeckoHistory, failOnError: true },
    { name: 'Yahoo History', run: loadYahooHistory, failOnError: false },
    { name: 'Latest Prices', run: latestPrices, failOnError: true },
];

export const runJobs = async () => {
    for (const job of jobs) {
        const startTime = Date.now();
        console.log(`============================= Starting job: ${job.name} =============================`);
        try {
            await job.run();
            const endTime = Date.now();
            console.log(`Completed job: ${job.name} in ${Math.round((endTime - startTime) / MINUTE_IN_MS)} minutes`);
        } catch (error) {
            console.error(`Error in job ${job.name}:`, error);
            if (job.failOnError) {
                console.error(`Job ${job.name} failed and is marked as failOnError. Stopping further execution.`);
                process.exit(1);
            }
        }
    }
    console.log('All jobs completed.');
}

await runJobs();