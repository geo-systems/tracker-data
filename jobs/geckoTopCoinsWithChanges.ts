import { set } from "lodash";
import { HOUR_IN_MS } from "../api/date.ts";
import { getTopCoinsWithChanges } from "../api/gecko.ts";
import { getRegisterItem, getRegisterItemAndTimestamp, setRegisterItem } from "../register/register.ts";
import { normaliseHistoryTuples } from "../api/util.ts";

export const TOP_COINS_WITH_DELTA_REG_KEY = "top-assets-with-delta";
export const run = async () => {
    const {data, lastUpdated} = getRegisterItemAndTimestamp(TOP_COINS_WITH_DELTA_REG_KEY);

    if (data && lastUpdated && (Date.now() - lastUpdated) < HOUR_IN_MS) {
        console.log("Supported assets with deltas are up to date.");
        return;
    }
    const updatedCoins = await getTopCoinsWithChanges(500);
    console.log(`Fetched ${Object.keys(updatedCoins).length} supported assets from Gecko.`);
    setRegisterItem(TOP_COINS_WITH_DELTA_REG_KEY, updatedCoins);

    // Update history with last price point, since we have it here already
    for (const coin of updatedCoins) {
        console.log(`Updating history for ${coin.id} with latest price point, while we have it...`);
        const coinHistory = getRegisterItem(`history/${coin.id}`);
        setRegisterItem(`history/${coin.id}`, normaliseHistoryTuples([
            ...(coinHistory || []),
            [coin.ts, coin.current_price, new Date(coin.ts).toISOString()],
        ]));
    }

}

// await run()