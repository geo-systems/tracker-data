import type { RetryOptions } from "../api/retry.ts";
import type { Clock } from "./Clock.ts";
import { SystemClock } from "./SystemClock.ts";

export interface FetchOptions<T> {
    headers?: Record<string, string>;
    transform?: (resp: Response) => Promise<T>;
}

export const get = async <T>(url: string, options: FetchOptions<T> = {}): Promise<T> => {
    // fetch data from the API with CORS disabled
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        throw new Error(`Error fetching data from ${url}: status=${response.status} ${response.statusText}`);
    }

    const data: T = await (options.transform ? options.transform(response) : response.json());
    return data;
}

export const getRetry = async <T>(clock: Clock, url: string, retryOptions: RetryOptions & FetchOptions<T> = {}): Promise<T | null> => {
    const { retries = 3, delayMs = 2000, jitterMs = 100, } = retryOptions;

    for(let attempt = 0; attempt < retries; attempt ++) {
        await clock.sleep(Math.floor(jitterMs * Math.random()));
        try {
            const result = await get<T>(url, retryOptions);
            return result;
        } catch (error) {
            if (error instanceof Error && error.message.includes('status=404')) {
                console.log(`Resource not found at ${url} (404) for ${url}. Not retrying.`);
                return null;
            }
            const actualDelay = delayMs * (attempt + 1) + Math.floor(jitterMs * Math.random());
            await clock.sleep(actualDelay);
        }
    }
    throw new Error(`Failed to fetch data from ${url} after ${retries} retries`);
}
