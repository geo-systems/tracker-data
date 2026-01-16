import { DAY_IN_MS } from "../api/date.ts";
import { getSupportedFiat } from "../api/gecko.ts";
import { getRegisterItem, getRegisterItemAndTimestamp, setRegisterItem } from "../register/register.ts";
import { SUPPORTED_CURRENCIES_REG_KEY } from "./usdExchangeRates.ts";

export const SUPPORTED_FIAT_REG_KEY = "supported-fiat";

export const run = async () => {
    const {data, lastUpdated} = getRegisterItemAndTimestamp(SUPPORTED_FIAT_REG_KEY);

    if (data && lastUpdated && (Date.now() - lastUpdated) < DAY_IN_MS) {
        console.log("Supported fiat currencies are up to date.");
        return;
    }

    let currencies = await getSupportedFiat();
    currencies = currencies!.map(c => c.toUpperCase());
    let ecbCurrencies = getRegisterItem(SUPPORTED_CURRENCIES_REG_KEY);
    ecbCurrencies = ecbCurrencies.map((c: string) => c.toUpperCase());
    const common = currencies.filter((c: string) => ecbCurrencies.includes(c.toUpperCase()));
    console.log(`Common supported fiat currencies: ${common.join(", ")}`);
    setRegisterItem(SUPPORTED_FIAT_REG_KEY, common);
}

// await run()