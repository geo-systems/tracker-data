import _ from "lodash";
import { get } from "../common/fetch.ts";
import { DAY_IN_MS } from "../common/date.ts";

interface FearAndGreedResponse {
    name: string;
    data: Array<{
        value: string;
        value_classification: string;
        timestamp: string;
        time_until_update?: string;
    }>;
    metadata: {
        error: string | null;
    };
}

/**
 * Fetches the Fear and Greed Index data from alternative.me API
 * @returns Array of tuples [timestamp, indexValue, classification]
 */
export const getFearAndGreedIndex = async (): Promise<Array<[number, number, string]>> => {
    const data = await get<FearAndGreedResponse>('https://api.alternative.me/fng/?limit=0');
    
    if (data.metadata.error) {
        throw new Error(`Error fetching Fear and Greed Index: ${data.metadata.error}`);
    }

    const result: Array<[number, number, string]> = data.data.map(item => {
        const timestamp = parseInt(item.timestamp) * 1000; // Convert to milliseconds
        const indexValue = parseInt(item.value);
        const classification = item.value_classification;
        return [timestamp, indexValue, classification];
    });
    // Extend data by 7 days into the future
    const lastValue = _.maxBy(result, r => r[0]);
    if (lastValue) {
        for (let i = 1; i <= 7; i++) {
            result.push([lastValue[0] + i * DAY_IN_MS, lastValue[1], lastValue[2]]);
        }
    }
    return result;
};
