import { DAY_IN_MS, MINUTE_IN_MS } from "../api/date.ts";
import { sleep } from "../api/fetch.ts";
import { history } from "../api/gecko.ts";
import { normaliseHistoryTuples } from "../api/util.ts";
import { getRegisterItem, getRegisterItemAndTimestamp, getRegisterItemLastUpdated, setRegisterItem } from "../register/register.ts";
import { SUPPORTED_ASSETS_REG_KEY } from "./geckoSupportedAssets.ts";
import _ from "lodash"


export const run = async () => {
    const coins: Record<string, any> = getRegisterItem(SUPPORTED_ASSETS_REG_KEY);
    for (const coin of Object.values(coins)) {
        const coinKey = `history/${coin.id}`;
        const {data: currentHistory, lastUpdated} = getRegisterItemAndTimestamp(coinKey);

        const newHistoryItems: Array<[number, number]> = [];

        if (currentHistory && lastUpdated && (Date.now() - lastUpdated) < DAY_IN_MS * 5) {
            console.log(`History for ${coin.id} is up to date.`);
            continue
        } else if (currentHistory && lastUpdated && (Date.now() - lastUpdated) < 89 * DAY_IN_MS) {
            console.log(`Fetching 90 days history for ${coin.id}...`);
            const threeMonths = await history(coin.id, 90);
            // setRegisterItem(coingKey, combineHistories(currentHistory, historyData));
            newHistoryItems.push(...threeMonths);
        } else {
            console.log(`Fetching full history for ${coin.id}...`);
            const year = await history(coin.id, 365);
            newHistoryItems.push(...year);
            await sleep(0.3 * MINUTE_IN_MS);
            const threeMonths = await history(coin.id, 90);
            newHistoryItems.push(...threeMonths);
        }

        const finalHistory = [...(currentHistory || []), ...newHistoryItems];
        setRegisterItem(coinKey, normaliseHistoryTuples(finalHistory));
        await sleep(0.3 * MINUTE_IN_MS);
    }

}

// await run()