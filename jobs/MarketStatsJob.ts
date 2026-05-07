import { HOUR_IN_MS, MINUTE_IN_MS } from "../common/date.ts";
import { getGlobalMarketStats, getBtcAthInfo, getTopExchangeVolumes } from "../api/gecko.ts";
import type { ExchangeVolume } from "../api/gecko.ts";
import { getGoldStats, getAssetPerformance } from "../api/yahooTradFi.ts";
import type { ChangePercentage } from "../api/yahooTradFi.ts";
import { getBtcHalvingInfo } from "../api/mempool.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import type Job from "./Job.ts";

export type VixClassification = 'complacency' | 'calm' | 'elevated' | 'fear' | 'panic';

const classifyVix = (index: number): VixClassification => {
    if (index < 12) return 'complacency';
    if (index < 20) return 'calm';
    if (index < 30) return 'elevated';
    if (index < 40) return 'fear';
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
        // Keyed by coin symbol (e.g. "btc", "eth"), values are percentages 0–100
        dominance_percentages: Record<string, number>;
        // oz of gold 1 BTC can buy — rising means BTC outperforming gold
        btc_gold_ratio: number;
        btc_gold_ratio_change_percentage: ChangePercentage;
    };
    totalCryptoMarketCap: PricedAsset;
    gold: PricedAsset;
    silver: PricedAsset;
    oil: PricedAsset;
    sp500: PricedAsset;
    nasdaq: PricedAsset;
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
}

export class MarketStatsJob implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    async run(): Promise<void> {
        const { data: oldData, lastUpdated } = this.register.getItemAndTimestamp(MARKET_STATS_REG_KEY);
        const cached = oldData as MarketStats | undefined;

        if (cached && lastUpdated && (this.clock.now() - lastUpdated) < 2.75 * HOUR_IN_MS) {
            console.log("Market stats are up to date. Skipping fetch.");
            return;
        }

        const tryFetch = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
            try {
                return await fn();
            } catch (err) {
                console.warn(`[MarketStatsJob] ${label} failed, retaining cached value: ${err instanceof Error ? err.message : err}`);
                return null;
            }
        };

        console.log("Fetching global market stats from CoinGecko...");
        const globalStats = await tryFetch('CoinGecko global', () => getGlobalMarketStats(this.clock));

        await this.clock.sleep(MINUTE_IN_MS * 0.3);

        console.log("Fetching TradFi stats from Yahoo Finance...");
        const [goldStats, silverStats, oilStats, sp500Stats, nasdaqStats, vixStats, treasury10yStats] = await Promise.all([
            tryFetch('gold (GC=F)', () => getGoldStats(this.clock)),
            tryFetch('silver (SI=F)', () => getAssetPerformance('SI=F', this.clock)),
            tryFetch('oil (CL=F)', () => getAssetPerformance('CL=F', this.clock)),
            tryFetch('S&P500 (^GSPC)', () => getAssetPerformance('^GSPC', this.clock)),
            tryFetch('NASDAQ (^NDX)', () => getAssetPerformance('^NDX', this.clock)),
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
                    h24: globalStats.market_cap_change_percentage_24h_usd,
                    d7: null,
                    d30: null,
                    y1: null,
                },
            } : cached!.totalCryptoMarketCap,
            global: {
                total_24h_volume_usd: globalStats?.total_24h_volume_usd ?? cached!.global.total_24h_volume_usd,
                dominance_percentages: globalStats?.market_cap_percentage ?? cached!.global.dominance_percentages,
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
            sp500: sp500Stats ? {
                price_usd: sp500Stats.price,
                change_percentage: sp500Stats.change_percentage,
            } : cached!.sp500,
            nasdaq: nasdaqStats ? {
                price_usd: nasdaqStats.price,
                change_percentage: nasdaqStats.change_percentage,
            } : cached!.nasdaq,
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
        };

        this.register.setItem(MARKET_STATS_REG_KEY, marketStats);
        console.log("Market stats saved.");
    }
}
