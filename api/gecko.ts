import { MINUTE_IN_MS } from "../common/date.ts";
import { getRetry } from "../common/fetch.ts";
import { sleep } from "../common/sleep.ts";
import _ from "lodash";

export const getSupportedFiat = async () => {
    const data = await getRetry<string[]>(`https://api.coingecko.com/api/v3/simple/supported_vs_currencies`, {
        retries: 3,
        delayMs: MINUTE_IN_MS,
        jitterMs: 1000,
    });
    return data;
}

export interface Coin {
    id: string;
    symbol: string;
    name: string;
    image_large_url: string;
    image_small_url: string;
    market_cap: number;
    market_cap_rank: number;
    index?: number;
}

export interface CoinWithSparkline extends Coin {
    current_price: number;
    ts: number;
    sparkline_in_7d: number[];
}

export interface CoinWithChanges extends Coin {
    current_price: number;
    price_change_percentage_14d_in_currency: number;
    price_change_percentage_1y_in_currency: number;
    price_change_percentage_200d_in_currency: number;
    price_change_percentage_24h_in_currency: number;
    price_change_percentage_30d_in_currency: number;
    price_change_percentage_7d_in_currency: number;
    ts: number;
}

const toCoinDictionary = (coins: Coin[]): Record<string, Coin> => {
    const dict: Record<string, Coin> = {};
    coins.forEach((coin, i) => {
        dict[coin.id] = coin;
        dict[coin.id].index = i;
    });
    return dict;
}
const toImage = (image: string): string => image = image?.replace(/\?\d+$/gi, '');
const toSmallImage = (image: string): string => image = toImage(image)?.replace(/\/large\//gi, '/small/');
const toCoin = (rawData: any): Coin => ({
    id: rawData.id,
    symbol: rawData.symbol,
    name: rawData.name,
    image_large_url: toImage(rawData.image),
    image_small_url: toSmallImage(rawData.image),
    market_cap_rank: rawData.market_cap_rank,
    market_cap: rawData.market_cap,
});

// Coin definitions
export const getSupportedCoins = async () => {
    const pages = 4;
    const perPage = 250;
    const allCoins = [];
    for (let page = 1; page <= pages; page++) {
        console.log(`Fetching supported coins from Gecko, page ${page}/${pages}...`);
        const data = await getRetry<any[]>(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=USD&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&locale=en`, 
            { 
                retries: 3,
                delayMs: MINUTE_IN_MS,
                jitterMs: 1000,
            }
        );

        // We've exhausted all coins
        if (!data || data.length < 250) {
            break;
        }

        allCoins.push(...data.map(toCoin));
        if (page < pages) {
            // to avoid rate limiting
            await sleep(MINUTE_IN_MS * 0.3);
        }
    }
    return toCoinDictionary(allCoins);
}

// Top Coins with prices changes
export const getTopCoinsWithChanges = async (n = 500): Promise<CoinWithChanges[]> => {
    const pageSize = 250;
    const pages = Math.ceil(n / pageSize);
    const coins: CoinWithChanges[] = [];
    for (let i = 1; i <= pages; i++) {
        const data = await getRetry<any[]>(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=USD&order=market_cap_desc&per_page=${pageSize}&page=${i}&sparkline=false&price_change_percentage=24h,7d,14d,30d,200d,1y`, 
            {
                retries: 3,
                delayMs: MINUTE_IN_MS,
                jitterMs: 1000,
            });
        const coinsPage: CoinWithChanges[] = data!.map((rawCoin: any) => ({
            ...toCoin(rawCoin),
            current_price: rawCoin.current_price,
            price_change_percentage_14d_in_currency: rawCoin.price_change_percentage_14d_in_currency,
            price_change_percentage_1y_in_currency: rawCoin.price_change_percentage_1y_in_currency,
            price_change_percentage_200d_in_currency: rawCoin.price_change_percentage_200d_in_currency,
            price_change_percentage_24h_in_currency: rawCoin.price_change_percentage_24h_in_currency,
            price_change_percentage_30d_in_currency: rawCoin.price_change_percentage_30d_in_currency,
            price_change_percentage_7d_in_currency: rawCoin.price_change_percentage_7d_in_currency,
            ts: Date.now(),
        }));
        coins.push(...coinsPage);
        if (i < pages) {
            // to avoid rate limiting
            await sleep(MINUTE_IN_MS * 0.3);
        }
    }

    return coins;  
}

export const getCoinsWithSparkline = async (coinIds: string[]): Promise<CoinWithSparkline[]> => {
    // use lodash to chunk
    const chunks = _.chunk(coinIds, 50);
    console.log(`Fetching ${coinIds.length} coins with sparkline from Gecko in ${chunks.length} chunks with size 50...`);
    const coins: CoinWithSparkline[] = [];
    let chunkIndex = 0;
    for (const chunk of chunks) {
        const idsParam = chunk.join(',');
        console.log(`${new Date().toISOString()} Fetching chunk ${chunkIndex + 1}/${chunks.length}...`);
        const data = await getRetry<any[]>(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=USD&ids=${idsParam}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h`, 
            {
                retries: 3,
                delayMs: MINUTE_IN_MS,
                jitterMs: 1000,
            }) ?? [];
        const coinsChunk: CoinWithSparkline[] = data.map((rawCoin: any) => ({
            ...toCoin(rawCoin),
            ts: Date.now(),
            current_price: rawCoin.current_price,
            sparkline_in_7d: rawCoin.sparkline_in_7d?.price || [],
        }));
        coins.push(...coinsChunk);
        chunkIndex++;
        if (chunkIndex < chunks.length) {
            // to avoid rate limiting
            await sleep(MINUTE_IN_MS * 0.3);
        }
    }
    return coins;
}

export const history = async (coinId: string, days: number) => {
    const data = await getRetry<{prices: Array<[number, number]>}>(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`, 
        {
            retries: 3,
            delayMs: MINUTE_IN_MS,
            jitterMs: 1000,
        });
    return data?.prices ?? [];
}
