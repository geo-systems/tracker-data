export const tryFetch = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
        return await fn();
    } catch (err) {
        console.warn(`${label} failed, retaining cached value: ${err instanceof Error ? err.message : err}`);
        return null;
    }
};
