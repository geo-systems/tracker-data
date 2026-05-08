import YahooFinance from "yahoo-finance2";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import { DAY_IN_MS, toDateIso } from "../common/date.ts";
import { withRetry } from "../common/withRetry.ts";

const yahooFinance = new YahooFinance();

export type ChangePercentage = { "1d": number | null; "7d": number | null; "30d": number | null; "1y": number | null };

export interface AssetPerformance {
    price: number;
    change_percentage: ChangePercentage;
}

export interface GoldStats extends AssetPerformance {
    // oz of gold 1 BTC can buy — rising = BTC outperforming gold
    btc_gold_ratio: number;
    btc_gold_ratio_change_percentage: ChangePercentage;
}

type QuotePoint = { ts: number; close: number };

const percentageDelta = (current: number, past: number | undefined): number | null =>
    past != null && past !== 0 ? ((current - past) / past) * 100 : null;

const getClosest = (quotes: QuotePoint[], targetTs: number): number | undefined => {
    const tolerance = 3 * DAY_IN_MS;
    let best: QuotePoint | undefined;
    for (const q of quotes) {
        if (Math.abs(q.ts - targetTs) <= tolerance) {
            if (!best || Math.abs(q.ts - targetTs) < Math.abs(best.ts - targetTs)) best = q;
        }
    }
    return best?.close;
};

const fetchQuotes = async (symbol: string, clock: Clock): Promise<QuotePoint[]> => {
    const data = await withRetry(clock, () => yahooFinance.chart(symbol, {
        period1: toDateIso(clock.now(), 370),
        interval: '1d',
    }));
    return data.quotes
        .filter(q => q.close != null)
        .map(q => ({ ts: q.date.getTime(), close: q.close! }));
};

const toPerformance = (quotes: QuotePoint[], now: number): AssetPerformance => {
    const current = quotes.at(-1)?.close;
    if (current == null) throw new Error('No quote data returned');
    return {
        price: current,
        change_percentage: {
            "1d": percentageDelta(current, getClosest(quotes, now - DAY_IN_MS)),
            "7d": percentageDelta(current, getClosest(quotes, now - 7 * DAY_IN_MS)),
            "30d": percentageDelta(current, getClosest(quotes, now - 30 * DAY_IN_MS)),
            "1y": percentageDelta(current, getClosest(quotes, now - 365 * DAY_IN_MS)),
        },
    };
};

export const getAssetPerformance = async (
    symbol: string,
    clock: Clock = new SystemClock(),
): Promise<AssetPerformance> => {
    const quotes = await fetchQuotes(symbol, clock);
    return toPerformance(quotes, clock.now());
};

/**
 * Fetches gold (GC=F) and BTC-USD from Yahoo Finance and computes the
 * BTC/gold ratio (oz of gold per 1 BTC) with historical deltas.
 */
export const getGoldStats = async (clock: Clock = new SystemClock()): Promise<GoldStats> => {
    const now = clock.now();
    const [goldQuotes, btcQuotes] = await Promise.all([
        fetchQuotes('GC=F', clock),
        fetchQuotes('BTC-USD', clock),
    ]);

    const goldPerf = toPerformance(goldQuotes, now);
    const currentBtcPrice = btcQuotes.at(-1)!.close;
    const currentRatio = currentBtcPrice / goldPerf.price;

    const ratioAt = (daysAgo: number): number | undefined => {
        const targetTs = now - daysAgo * DAY_IN_MS;
        const g = getClosest(goldQuotes, targetTs);
        const b = getClosest(btcQuotes, targetTs);
        return g != null && b != null ? b / g : undefined;
    };

    return {
        ...goldPerf,
        btc_gold_ratio: currentRatio,
        btc_gold_ratio_change_percentage: {
            "1d": percentageDelta(currentRatio, ratioAt(1)),
            "7d": percentageDelta(currentRatio, ratioAt(7)),
            "30d": percentageDelta(currentRatio, ratioAt(30)),
            "1y": percentageDelta(currentRatio, ratioAt(365)),
        },
    };
};
