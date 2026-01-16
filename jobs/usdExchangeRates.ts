import _ from "lodash";
import { DAY_IN_MS, HOUR_IN_MS } from "../api/date.ts";
import { fetchEcbData, fetchSupportedCurrencies } from "../api/ecb.ts";
import { getRegisterItemAndTimestamp, setRegisterItem } from "../register/register.ts";

const key = "usd-exchange-rates";
export const SUPPORTED_CURRENCIES_REG_KEY = `${key}/supported_currencies`;

const getDuration = (lastUpdated: number | null): 'full' | '90days' | 'daily' | null => {
    const now = Date.now();
    // console.log({ lastUpdated, now, delta: lastUpdated ? now - lastUpdated : null });
    if (lastUpdated && (now - lastUpdated) < HOUR_IN_MS) {
        return null;
    } else if (!lastUpdated || now-lastUpdated >= 30 * DAY_IN_MS) {
        return "full";
    } else if (now - lastUpdated >= DAY_IN_MS) {
        return "90days";
    } else {
        return "daily";
    }
}

export const run = async () => {
    const currencies = await fetchSupportedCurrencies();

    const { lastUpdated } = getRegisterItemAndTimestamp(key);
    const duration = getDuration(lastUpdated);
    if (!duration) {
        console.log("USD exchange rates are up to date.");
        return;
    }

    const update = await fetchEcbData(duration);
    console.log(`Updating USD exchange rates with ${duration} data.`);
    setRegisterItem(`${key}/supported_currencies`, currencies);
    for (const currency of currencies) {
        let {data: currencyData} = getRegisterItemAndTimestamp(`${key}/${currency}`);
        let currencyUpdate = _.mapValues(update, (entry: any) => entry[currency]);
        setRegisterItem(`${key}/${currency}`, { ...currencyData, ...currencyUpdate });
    }
     // just to update the timestamp
    setRegisterItem(key);
}

// await run()



