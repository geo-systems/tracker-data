import _ from "lodash"

import { getRegisterItem, getRegisterItemLastUpdated, setRegisterItem } from "../register/register.ts";
import { SUPPORTED_ASSETS_REG_KEY } from "./geckoSupportedAssets.ts";
import { DAY_IN_MS, HOUR_IN_MS } from "../api/date.ts";
import { getYHistory } from "../api/yahoo.ts";
import { normaliseHistoryTuples } from "../api/util.ts";


export const run = async () => {
    // Use chart: https://jsr.io/@gadicc/yahoo-finance2/doc/modules/chart#example_4
    const coins: Record<string, any> = getRegisterItem(SUPPORTED_ASSETS_REG_KEY);
    for (const coin of Object.values(coins)) {
        const coinKey = `history/${coin.id}`;
        const currentHistory = getRegisterItem(coinKey);
        const timestamps = currentHistory.map((item: any) => item[0]);
        const lastHistoryItemTs: number = _.max(timestamps) ?? 0;

        const coinYahooKey = `history/yahoo/${coin.id}`;
        const lastUpdated = getRegisterItemLastUpdated(coinYahooKey);
        const newHistoryItems: Array<[number, number, string]> = [];

        // If we updated recently enough, skip
        if (lastUpdated) {
            if (Date.now() - lastHistoryItemTs < 5 * DAY_IN_MS) {
                console.log(`History for ${coin.id} is up to date.`);
                continue;
            } 
    
            if (lastUpdated && (Date.now() - lastUpdated) < 8 * DAY_IN_MS) {
                console.log(`History for ${coin.id} is up to date.`);
                continue;
            } 
        } else if (coin.rank > 500) {
            console.log(`Fetching full Yahoo history for ${coin.id}...`);
            const full = await getYHistory(coin.symbol, '1d');
            newHistoryItems.push(...full);
            const fewMonths = await getYHistory(coin.symbol, '1h', 30);
            newHistoryItems.push(...fewMonths);

            // Mark it as updated
            setRegisterItem(coinYahooKey);
            if (newHistoryItems.length > 0) {
                const finalHistory = [...(currentHistory || []), ...newHistoryItems];
                setRegisterItem(coinKey, normaliseHistoryTuples(finalHistory));
            }
        }

    }
}

// await run()