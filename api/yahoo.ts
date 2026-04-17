import YahooFinance from "yahoo-finance2";
import type { ChartOptionsWithReturnArray } from "yahoo-finance2/modules/chart";
import { START_OF_CRYPTO_DAY, toDateIso } from "../common/date.ts";
import type { RetryOptions } from "./retry.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
const yahooFinance = new YahooFinance();


export const getYahooHistory = async (coinId: string, 
                                      frequency: ChartOptionsWithReturnArray['interval'], 
                                      daysAgo?: number, 
                                      retryOptions?: RetryOptions,
                                      clock: Clock = new SystemClock()): Promise<Array<[number, number, string]>> => {
    const { retries = 3, delayMs = 2000, jitterMs = 100, } = retryOptions || {};
    const now = clock.now();
    const symbol = `${coinId.toUpperCase()}-USD`;

    for(let attempt = 0; attempt < retries; attempt ++) {
        await clock.sleep(Math.floor(jitterMs * Math.random()));
        try {
            const data = await yahooFinance.chart(symbol, {
                period1: daysAgo ? toDateIso(now, daysAgo) : START_OF_CRYPTO_DAY,
                interval: frequency
            });
            return data.quotes.map(q => ([
                q.date.getTime(), q.close ?? q.adjclose ?? q.open!, q.date.toISOString()
            ]));
        } catch (error) {
            if (error instanceof Error && error.message.includes('No data found')) {
                console.warn(`No data found for ${symbol}, skipping further retries.`);
                return [];
            } else if(error instanceof Error && error.message.includes('granularity data are allowed to be fetched per request')) {
                console.warn(`Data frequency ${frequency} not available for ${symbol}, skipping further retries.`);
                return [];
            }
            const actualDelay = delayMs * (attempt + 1) + Math.floor(jitterMs * Math.random());
            await clock.sleep(actualDelay);
        }
    }
    throw new Error(`Failed to fetch data from ${symbol} after ${retries} retries`);
}