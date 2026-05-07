import { get } from "../common/fetch.ts";

const HALVING_INTERVAL = 210_000;

export interface BtcHalvingInfo {
    estimated_days_remaining: number;
    estimated_days_since_last_halving: number;
    // 0–100: how far through the current 4-year halving cycle we are
    estimated_halving_cycle_percentage: number;
}

/**
 * Fetches the current BTC block height from mempool.space and computes
 * the countdown to the next halving (every 210,000 blocks, ~10 min/block).
 */
export const getBtcHalvingInfo = async (clock: { now(): number }): Promise<BtcHalvingInfo> => {
    const height = await get<number>('https://mempool.space/api/blocks/tip/height', {
        transform: async (resp) => parseInt(await resp.text(), 10),
    });

    const halvingNumber = Math.floor(height / HALVING_INTERVAL) + 1;
    const nextHalvingBlock = halvingNumber * HALVING_INTERVAL;
    const lastHalvingBlock = (halvingNumber - 1) * HALVING_INTERVAL;
    const blocksRemaining = nextHalvingBlock - height;
    const estimatedDaysRemaining = Math.round((blocksRemaining * 10) / (60 * 24));
    const estimatedDate = new Date(clock.now() + estimatedDaysRemaining * 24 * 60 * 60 * 1000);

    const blocksElapsed = HALVING_INTERVAL - blocksRemaining;

    return {
        estimated_days_remaining: estimatedDaysRemaining,
        estimated_days_since_last_halving: Math.round((blocksElapsed * 10) / (60 * 24)),
        estimated_halving_cycle_percentage: Math.round((blocksElapsed / HALVING_INTERVAL) * 100),
    };
};
