import type { Clock } from "./Clock.ts";
import { MINUTE_IN_MS } from "./date.ts";

export const withRetry = async <T>(
    clock: Clock,
    fn: () => Promise<T>,
    retries = 3,
    delayMs = MINUTE_IN_MS / 2,
    jitterMs = 1000,
): Promise<T> => {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt === retries - 1) throw err;
            const backoff = delayMs * (attempt + 1) + Math.floor(jitterMs * Math.random());
            console.warn(`Request failed (attempt ${attempt + 1}/${retries}), retrying in ${Math.round(backoff / 1000)}s...`);
            await clock.sleep(backoff);
        }
    }
    throw new Error('unreachable');
};
