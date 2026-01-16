import { DAY_IN_MS, MINUTE_IN_MS, WEEK_IN_MS } from "../api/date.ts";
import { sleep } from "../api/fetch.ts";
import { getCoinsWithSparkline, history } from "../api/gecko.ts";
import { normaliseHistoryTuples } from "../api/util.ts";
import { getRegisterItem, getRegisterItemAndTimestamp, getRegisterItemLastUpdated, setRegisterItem } from "../register/register.ts";
import { SUPPORTED_ASSETS_REG_KEY } from "./geckoSupportedAssets.ts";
import _ from "lodash"


export const run = async () => {
    const coins: Record<string, any> = getRegisterItem(SUPPORTED_ASSETS_REG_KEY);

    const coinIds = Object.keys(coins);
    const eligibleCoinIds = coinIds.filter(coinId => {
        const lastUpdated = getRegisterItemLastUpdated(`history/${coinId}`);
        return !lastUpdated || (Date.now() - lastUpdated) > MINUTE_IN_MS * 5;
    });
    const coinsWithSparkline = await getCoinsWithSparkline(eligibleCoinIds);
    for (const coin of coinsWithSparkline) {
        const coinHistory = getRegisterItem(`history/${coin.id}`) ?? [];
        const ts = coin.ts;
        const lastKnown = _.minBy(coinHistory, (h: any[]) => h[0]);
        const lastKnownTs = lastKnown ? lastKnown[0] : 0;
        // Add the last one - we know it for sure
        coinHistory.push([ts, coin.current_price, new Date(ts).toISOString()]);

        // Fill in the gaps with sparkline data
        for (let i = 0; i < coin.sparkline_in_7d.length; i++) {
            const startOfWeekTs = ts - WEEK_IN_MS;
            const perRecordOffset = WEEK_IN_MS / coin.sparkline_in_7d.length;
            const sparkTs = startOfWeekTs + (i * perRecordOffset);
            if (sparkTs > lastKnownTs && sparkTs < ts) {
                coinHistory.push([sparkTs, coin.sparkline_in_7d[i], new Date(sparkTs).toISOString()]);
            }
        }
        setRegisterItem(`history/${coin.id}`, normaliseHistoryTuples(coinHistory));
     }
}

// await run()