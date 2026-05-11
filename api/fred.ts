import { getRetry } from "../common/fetch.ts";
import type { Clock } from "../common/Clock.ts";
import type { ChangePercentage } from "./yahooTradFi.ts";
import { DAY_IN_MS } from "../common/date.ts";

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

export interface MacroIndicator {
    value: number;
    change_percentage: ChangePercentage;
}

type ObsPoint = { ts: number; value: number };

const percentageDelta = (current: number, past: number | undefined): number | null =>
    past != null && past !== 0 ? ((current - past) / past) * 100 : null;

const getClosest = (obs: ObsPoint[], targetTs: number, toleranceMs: number): number | undefined => {
    let best: ObsPoint | undefined;
    for (const o of obs) {
        if (Math.abs(o.ts - targetTs) <= toleranceMs) {
            if (!best || Math.abs(o.ts - targetTs) < Math.abs(best.ts - targetTs)) best = o;
        }
    }
    return best?.value;
};

const fetchObservations = async (seriesId: string, clock: Clock): Promise<ObsPoint[]> => {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) throw new Error('FRED_API_KEY environment variable is not set');

    const startDate = new Date(clock.now() - 400 * DAY_IN_MS).toISOString().split('T')[0];
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${startDate}`;

    const data = await getRetry<{ observations: { date: string; value: string }[] }>(clock, url, {
        retries: 3,
        delayMs: 2000,
        jitterMs: 100,
    });

    if (!data) throw new Error(`Failed to fetch FRED series ${seriesId}`);

    return data.observations
        .filter(o => o.value !== '.')
        .map(o => ({ ts: new Date(o.date).getTime(), value: parseFloat(o.value) }));
};

// For monthly/quarterly series 1d/7d will naturally be null (no obs within 3 days of target).
// For daily series (DFF) all four periods will resolve.
const toIndicator = (obs: ObsPoint[], now: number): MacroIndicator => {
    const current = obs.at(-1)?.value;
    if (current == null) throw new Error('No observations returned');
    return {
        value: current,
        change_percentage: {
            "1d":  percentageDelta(current, getClosest(obs, now - DAY_IN_MS,         3 * DAY_IN_MS)),
            "7d":  percentageDelta(current, getClosest(obs, now - 7 * DAY_IN_MS,    3 * DAY_IN_MS)),
            "30d": percentageDelta(current, getClosest(obs, now - 30 * DAY_IN_MS,  45 * DAY_IN_MS)),
            "1y":  percentageDelta(current, getClosest(obs, now - 365 * DAY_IN_MS, 45 * DAY_IN_MS)),
        },
    };
};

// Core CPI (excl. food & energy) — monthly — Fed's key inflation gauge
export const getCoreCpi = async (clock: Clock): Promise<MacroIndicator> => {
    const obs = await fetchObservations('CPILFESL', clock);
    return toIndicator(obs, clock.now());
};

// M2 money supply — monthly — macro liquidity indicator
export const getM2 = async (clock: Clock): Promise<MacroIndicator> => {
    const obs = await fetchObservations('M2SL', clock);
    return toIndicator(obs, clock.now());
};

// Effective Federal Funds Rate — daily — monetary policy benchmark
export const getDff = async (clock: Clock): Promise<MacroIndicator> => {
    const obs = await fetchObservations('DFF', clock);
    return toIndicator(obs, clock.now());
};

// Eurozone HICP (all items) — monthly — EU equivalent of CPI
export const getEurozoneHicp = async (clock: Clock): Promise<MacroIndicator> => {
    const obs = await fetchObservations('CP0000EZ19M086NEST', clock);
    return toIndicator(obs, clock.now());
};

// US GDP — quarterly — economic output
export const getGdp = async (clock: Clock): Promise<MacroIndicator> => {
    const obs = await fetchObservations('GDP', clock);
    return toIndicator(obs, clock.now());
};

// US Unemployment Rate — monthly
export const getUnemployment = async (clock: Clock): Promise<MacroIndicator> => {
    const obs = await fetchObservations('UNRATE', clock);
    return toIndicator(obs, clock.now());
};
