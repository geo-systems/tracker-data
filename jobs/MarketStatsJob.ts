import { HOUR_IN_MS, MINUTE_IN_MS, DAY_IN_MS } from "../common/date.ts";
import { getGlobalMarketStats, getBtcAthInfo, getTopExchangeVolumes } from "../api/gecko.ts";
import type { ExchangeVolume, CoinWithChanges } from "../api/gecko.ts";
import { getGoldStats, getAssetPerformance } from "../api/yahooTradFi.ts";
import type { ChangePercentage } from "../api/yahooTradFi.ts";
import { getBtcHalvingInfo } from "../api/mempool.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import type Job from "./Job.ts";
import { tryFetch } from "../common/tryFetch.ts";
import _ from "lodash";

export type VixClassification = 'complacency' | 'normal' | 'elevated' | 'high_fear' | 'panic';
export interface DominanceEntry extends PricedAsset {
    id: string;
    symbol: string;
    name: string;
    market_dominance_percent: number;
    market_dominance_percent_delta: ChangePercentage;
    image_large_url: string;
    image_small_url: string;
    market_cap_rank: number;
    market_cap: number;
    fully_diluted_valuation: number | null;
}

export interface FearAndGreedEntry {
    index: number;
    classification: string;
}

export interface FearAndGreed {
    index: number;
    classification: string;
    changes: {
        "1d": FearAndGreedEntry;
        "7d": FearAndGreedEntry;
        "30d": FearAndGreedEntry;
        "1y": FearAndGreedEntry;
    };
}

const classifyVix = (index: number): VixClassification => {
    if (index < 12) {
        return 'complacency';
    }
    if (index < 20) {
        return 'normal';
    }
    if (index < 30) {
        return 'elevated';
    }
    if (index < 40) {
        return 'high_fear';
    }
    return 'panic';
};

export const MARKET_STATS_REG_KEY = "market-stats";

export interface PricedAsset {
    price_usd: number;
    change_percentage: ChangePercentage;
}

export interface MarketStats {
    ts: number;
    global: {
        total_24h_volume_usd: number;
        // Keyed by coin symbol (e.g. "btc", "eth")
        asset_dominance: Record<string, DominanceEntry>;
        // oz of gold 1 BTC can buy — rising means BTC outperforming gold
        btc_gold_ratio: number;
        btc_gold_ratio_change_percentage: ChangePercentage;
    };
    totalCryptoMarketCap: PricedAsset;
    gold: PricedAsset;
    silver: PricedAsset;
    oil: PricedAsset;
    copper: PricedAsset;
    sp500: PricedAsset;
    nasdaq: PricedAsset;
    dowJones: PricedAsset;
    // Volatility index for US stocks — dimensionless implied volatility score; rising = fear, falling = complacency
    vix: {
        index: number;
        classification: VixClassification;
        change_percentage: ChangePercentage;
    };
    // US 10-year Treasury yield — rising yield = risk-off headwind for crypto
    treasury10y: {
        yield_percentage: number;
        change_percentage: ChangePercentage;
    };
    btcAth: {
        ath_usd: number;
        ath_date_iso: string;
        // negative: how far current price is below ATH in %
        ath_change_percentage: number;
        current_price_usd: number;
    };
    topExchanges: ExchangeVolume[];
    btcHalving: {
        estimated_days_remaining: number;
        estimated_days_since_last_halving: number;
        // 0–100: how far through the current 4-year halving cycle we are
        estimated_halving_cycle_percentage: number;
    };
    fearAndGreed: FearAndGreed;
}

export class MarketStatsJob implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    private computeFearAndGreed(): FearAndGreed | null {
        type FngTuple = [number, number, string, string];
        const data = this.register.getItem('fear-and-greed') as FngTuple[];
        if (!data?.length) {
            return null
        };

        const latest = _.maxBy(data, entry => entry[0])!;
        const [latestTs, currentIndex, currentClassification] = latest;

        const findClosest = (targetTs: number): FngTuple =>
            _.minBy(data, entry => Math.abs(entry[0] - targetTs))!;

        const toEntry = (entry: FngTuple): FearAndGreedEntry => ({ index: entry[1], classification: entry[2] });

        return {
            index: currentIndex,
            classification: currentClassification,
            changes: {
                "1d": toEntry(findClosest(latestTs - DAY_IN_MS)),
                "7d": toEntry(findClosest(latestTs - 7 * DAY_IN_MS)),
                "30d": toEntry(findClosest(latestTs - 30 * DAY_IN_MS)),
                "1y": toEntry(findClosest(latestTs - 365 * DAY_IN_MS)),
            },
        };
    }

    private computeDominancePercentages(marketCapPercentage: Record<string, number>, topAssets: CoinWithChanges[]): Record<string, DominanceEntry> {
        type PctField = 'price_change_percentage_24h_in_currency' | 'price_change_percentage_7d_in_currency' | 'price_change_percentage_30d_in_currency' | 'price_change_percentage_1y_in_currency';

        const topAssetsBySymbol = _.keyBy(topAssets, c => c.symbol);

        // Precompute past total market cap for each period using all top assets
        const pastTotalCap = (field: PctField): number =>
            _.sumBy(topAssets, c => c.market_cap / (1 + (c[field] ?? 0) / 100));

        const pastTotalCaps = {
            "1d":  pastTotalCap('price_change_percentage_24h_in_currency'),
            "7d":  pastTotalCap('price_change_percentage_7d_in_currency'),
            "30d": pastTotalCap('price_change_percentage_30d_in_currency'),
            "1y":  pastTotalCap('price_change_percentage_1y_in_currency'),
        };

        // Dominance delta = current dominance% - past dominance%
        const dominanceDelta = (coin: CoinWithChanges, currentDominancePct: number, field: PctField, pastTotal: number): number | null => {
            const changePct = coin[field] as number | null;
            if (pastTotal === 0 || changePct == null) return null;
            const pastCoinCap = coin.market_cap / (1 + changePct / 100);
            return currentDominancePct - (pastCoinCap / pastTotal) * 100;
        };

        const result: Record<string, DominanceEntry> = {};
        for (const [symbol, pct] of Object.entries(marketCapPercentage)) {
            const coin = topAssetsBySymbol[symbol];
            if (coin == null) continue;
            result[symbol] = {
                market_dominance_percent: pct,
                market_dominance_percent_delta: {
                    "1d":  dominanceDelta(coin, pct, 'price_change_percentage_24h_in_currency', pastTotalCaps["1d"]),
                    "7d":  dominanceDelta(coin, pct, 'price_change_percentage_7d_in_currency',  pastTotalCaps["7d"]),
                    "30d": dominanceDelta(coin, pct, 'price_change_percentage_30d_in_currency', pastTotalCaps["30d"]),
                    "1y":  dominanceDelta(coin, pct, 'price_change_percentage_1y_in_currency',  pastTotalCaps["1y"]),
                },
                id: coin.id,
                symbol: coin.symbol,
                name: coin.name,
                image_large_url: coin.image_large_url,
                image_small_url: coin.image_small_url,
                market_cap_rank: coin.market_cap_rank,
                market_cap: coin.market_cap,
                fully_diluted_valuation: coin.fully_diluted_valuation,
                price_usd: coin.current_price,
                change_percentage: {
                    "1d": coin.price_change_percentage_24h_in_currency,
                    "7d": coin.price_change_percentage_7d_in_currency,
                    "30d": coin.price_change_percentage_30d_in_currency,
                    "1y": coin.price_change_percentage_1y_in_currency,
                },
            };
        }
        return result;
    }

    private computeMarketCapDeltas(currentCap?: number, topAssets: CoinWithChanges[] = []): Partial<{ "7d": number; "30d": number; "1y": number }> {
        if (!topAssets.length || currentCap == null) {
            return {};
        }

        type PctField = 'price_change_percentage_7d_in_currency' | 'price_change_percentage_30d_in_currency' | 'price_change_percentage_1y_in_currency';
        const pastCap = (pctField: PctField): number =>
            _.sumBy(topAssets, coin => coin.market_cap / (1 + (coin[pctField] as number) / 100));

        const delta = (past: number): number | undefined =>
            past > 0 ? ((currentCap - past) / past) * 100 : undefined;

        return {
            "7d": delta(pastCap('price_change_percentage_7d_in_currency')),
            "30d": delta(pastCap('price_change_percentage_30d_in_currency')),
            "1y": delta(pastCap('price_change_percentage_1y_in_currency')),
        };
    }

    async run(): Promise<void> {
        const { data: oldData, lastUpdated } = this.register.getItemAndTimestamp(MARKET_STATS_REG_KEY);
        const cached = oldData as MarketStats | undefined;

        if (cached && lastUpdated && (this.clock.now() - lastUpdated) < 2.75 * HOUR_IN_MS) {
            console.log("Market stats are up to date. Skipping fetch.");
            return;
        }

        console.log("Fetching global market stats from CoinGecko...");
        const globalStats = await tryFetch('CoinGecko global', () => getGlobalMarketStats(this.clock));
        const topAssets = (this.register.getItem('top-assets-with-delta') ?? []) as CoinWithChanges[];
        const globalDeltasPercent = this.computeMarketCapDeltas(globalStats?.total_market_cap_usd, topAssets);

        await this.clock.sleep(MINUTE_IN_MS * 0.1);

        console.log("Fetching TradFi stats from Yahoo Finance...");
        const [goldStats, silverStats, oilStats, copperStats, sp500Stats, nasdaqStats, dowJonesStats, vixStats, treasury10yStats] = await Promise.all([
            tryFetch('gold (GC=F)', () => getGoldStats(this.clock)),
            tryFetch('silver (SI=F)', () => getAssetPerformance('SI=F', this.clock)),
            tryFetch('oil (CL=F)', () => getAssetPerformance('CL=F', this.clock)),
            tryFetch('copper (HG=F)', () => getAssetPerformance('HG=F', this.clock)),
            tryFetch('S&P500 (^GSPC)', () => getAssetPerformance('^GSPC', this.clock)),
            tryFetch('NASDAQ (^NDX)', () => getAssetPerformance('^NDX', this.clock)),
            tryFetch('Dow Jones (^DJI)', () => getAssetPerformance('^DJI', this.clock)),
            tryFetch('VIX (^VIX)', () => getAssetPerformance('^VIX', this.clock)),
            tryFetch('Treasury 10y (^TNX)', () => getAssetPerformance('^TNX', this.clock)),
        ]);

        console.log("Fetching BTC ATH and top exchanges from CoinGecko...");
        const [btcAthResult, topExchangesResult] = await Promise.all([
            tryFetch('BTC ATH', () => getBtcAthInfo(this.clock)),
            tryFetch('top exchanges', () => getTopExchangeVolumes(this.clock)),
        ]);

        console.log("Fetching BTC halving info from mempool.space...");
        const halvingResult = await tryFetch('BTC halving', () => getBtcHalvingInfo(this.clock));

        const marketStats: MarketStats = {
            ts: this.clock.now(),
            totalCryptoMarketCap: globalStats ? {
                price_usd: globalStats.total_market_cap_usd,
                change_percentage: {
                    "1d": globalStats.market_cap_change_percentage_24h_usd,
                    "7d": globalDeltasPercent["7d"] ?? cached?.totalCryptoMarketCap.change_percentage["7d"] ?? 0,
                    "30d": globalDeltasPercent["30d"] ?? cached?.totalCryptoMarketCap.change_percentage["30d"] ?? 0,
                    "1y": globalDeltasPercent["1y"] ?? cached?.totalCryptoMarketCap.change_percentage["1y"] ?? 0,
                },
            } : cached!.totalCryptoMarketCap,
            global: {
                total_24h_volume_usd: globalStats?.total_24h_volume_usd ?? cached!.global.total_24h_volume_usd,
                asset_dominance: globalStats?.market_cap_percentage
                    ? this.computeDominancePercentages(globalStats.market_cap_percentage, topAssets)
                    : cached!.global.asset_dominance,
                btc_gold_ratio: goldStats?.btc_gold_ratio ?? cached!.global.btc_gold_ratio,
                btc_gold_ratio_change_percentage: goldStats?.btc_gold_ratio_change_percentage ?? cached!.global.btc_gold_ratio_change_percentage,
            },
            gold: goldStats ? {
                price_usd: goldStats.price,
                change_percentage: goldStats.change_percentage,
            } : cached!.gold,
            silver: silverStats ? {
                price_usd: silverStats.price,
                change_percentage: silverStats.change_percentage,
            } : cached!.silver,
            oil: oilStats ? {
                price_usd: oilStats.price,
                change_percentage: oilStats.change_percentage,
            } : cached!.oil,
            copper: copperStats ? {
                price_usd: copperStats.price,
                change_percentage: copperStats.change_percentage,
            } : cached!.copper,
            sp500: sp500Stats ? {
                price_usd: sp500Stats.price,
                change_percentage: sp500Stats.change_percentage,
            } : cached!.sp500,
            nasdaq: nasdaqStats ? {
                price_usd: nasdaqStats.price,
                change_percentage: nasdaqStats.change_percentage,
            } : cached!.nasdaq,
            dowJones: dowJonesStats ? {
                price_usd: dowJonesStats.price,
                change_percentage: dowJonesStats.change_percentage,
            } : cached!.dowJones,
            vix: vixStats ? {
                index: vixStats.price,
                classification: classifyVix(vixStats.price),
                change_percentage: vixStats.change_percentage,
            } : cached!.vix,
            treasury10y: treasury10yStats ? {
                yield_percentage: treasury10yStats.price,
                change_percentage: treasury10yStats.change_percentage,
            } : cached!.treasury10y,
            btcAth: btcAthResult ?? cached!.btcAth,
            topExchanges: topExchangesResult ?? cached!.topExchanges,
            btcHalving: halvingResult ?? cached!.btcHalving,
            fearAndGreed: this.computeFearAndGreed() ?? cached!.fearAndGreed,
        };

        this.register.setItem(MARKET_STATS_REG_KEY, marketStats);
        console.log("Market stats saved.");
    }
}
