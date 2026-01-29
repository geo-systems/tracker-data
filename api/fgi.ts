import { get } from "../common/fetch.ts";

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

    return data.data.map(item => {
        const timestamp = parseInt(item.timestamp) * 1000; // Convert to milliseconds
        const indexValue = parseInt(item.value);
        const classification = item.value_classification;
        return [timestamp, indexValue, classification];
    });
};
