export const ensureArray = <T>(obj: T | T[]): T[] => {
    if (Array.isArray(obj)) {
        return obj;
    } else {
        return [obj];
    }
}