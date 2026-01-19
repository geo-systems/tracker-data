import { XMLParser } from "fast-xml-parser";
import { getRetry } from "../common/fetch.ts";
import { ensureArray } from "../common/util.ts";
import { nextDate } from "../common/date.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import _ from "lodash";

const baseUrl = 'https://www.ecb.europa.eu/stats/eurofxref';
const fullHistoryUrl = `${baseUrl}/eurofxref-hist.xml`;
const recent90DaysUrl = `${baseUrl}/eurofxref-hist-90d.xml`;
const dailyUrl = `${baseUrl}/eurofxref-daily.xml`;

export type Duration = 'full' | '90days' | 'daily';
const getUrlForDuration = (duration: Duration): string => {
    switch (duration) {
        case 'full':
            return fullHistoryUrl;
        case '90days':
            return recent90DaysUrl;
        case 'daily':
            return dailyUrl;
    }
}
export async function fetchEcbData(clock: Clock, duration: Duration = 'full') {
    const rawXml = await getRetry(clock, getUrlForDuration(duration), {
        retries: 3,
        delayMs: 5000,
        jitterMs: 200,
        headers: {
            'Accept': 'application/xml',
        },
        transform: async (resp: Response) => await resp.text(),
    });

    if (!rawXml) {
        throw new Error(`Failed to fetch ECB data for duration=${duration}`);
    }

    const parser = new XMLParser(
        {
            ignoreAttributes: false,
            attributeNamePrefix: "",
        }
    );
    
    const jsonObj = parser.parse(rawXml, true);
    const cubes = ensureArray(jsonObj['gesmes:Envelope']['Cube']['Cube']);
    const result: any = {}
    for (let cube of cubes) {
        const parsed = parseCubes(cube);
        if (parsed) {
            result[parsed.time] = parsed;
            delete parsed['time'];
        }
    }

    // fill missing dates (weekends, holidays) with the previous date's data
    const minDate = _.min(Object.keys(result));
    const maxDate = _.max(Object.keys(result));
    if (minDate && maxDate) {
        let lastAvailableData: any = null;
        for (let date = minDate; date <= nextDate(maxDate, 7); date = nextDate(date)) {
            if (result[date]) {
                lastAvailableData = result[date];
            } else {
                // fill missing date with the previous date's data
                result[date] = {...lastAvailableData, time: date};
            }
        }
    }

    return result;
}

export const fetchSupportedCurrencies = async (clock: Clock = new SystemClock()) => {
    const data = await fetchEcbData(clock, 'daily');
    const firstEntry: any = Object.values(data)[0];
    return Object.keys(firstEntry).filter(key => key !== 'time');
}

const CUTOFF_DATE = new Date('2009-01-01');
const parseCubes = (cube: any) => {
    const time = cube['time'];
    // if time is earlier than 2009, return null
    if (new Date(time).getTime() < CUTOFF_DATE.getTime()) {
        return null;
    }
    const cubes = cube['Cube'];
    const usd = cubes.find((c: any) => c['currency'] === 'USD');
    const usdRate = parseFloat(usd['rate']);
    const res: any = { time };
    res['EUR'] = parseFloat((1 / usdRate).toFixed(4));
    for (const c of cubes) {
        res[c['currency']] = parseFloat((parseFloat(c['rate']) / usdRate).toFixed(4));
    }
    return res;
}


