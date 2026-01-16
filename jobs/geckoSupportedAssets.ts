import { DAY_IN_MS } from "../api/date.ts";
import { getSupportedCoins } from "../api/gecko.ts";
import { getRegisterItemAndTimestamp, setRegisterItem } from "../register/register.ts";

export const SUPPORTED_ASSETS_REG_KEY = "supported-assets";
export const run = async () => {
    const {data, lastUpdated} = getRegisterItemAndTimestamp(SUPPORTED_ASSETS_REG_KEY);

    if (data && lastUpdated && (Date.now() - lastUpdated) < DAY_IN_MS) {
        console.log("Supported assets are up to date.");
        return;
    }
    const updatedCoins = await getSupportedCoins();
    console.log(`Fetched ${Object.keys(updatedCoins).length} supported assets from Gecko.`);
    setRegisterItem(SUPPORTED_ASSETS_REG_KEY, {...data, ...updatedCoins});
}

// await run()