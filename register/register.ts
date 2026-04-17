export interface Register {
    getItemLastUpdated(key: string): any;
    getItem(key: string): any | null;
    getItemAndTimestamp(key: string): { data: any | null, lastUpdated: number | null };
    setItem(key: string, value?: any): void;
}
