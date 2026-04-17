import type { Clock } from '../common/Clock.ts';
import { SystemClock } from '../common/SystemClock.ts';
import type { Register } from './Register.ts';

export class InMemoryRegister implements Register {
    private readonly data: Map<string, any>;
    private readonly timestamps: Map<string, number>;
    private readonly clock: Clock;

    constructor(clock: Clock = new SystemClock()) {
        this.data = new Map();
        this.timestamps = new Map();
        this.clock = clock;
    }

    getItemLastUpdated(key: string): number | null {
        return this.timestamps.get(key) ?? null;
    }

    getItem(key: string): any | null {
        return this.data.get(key) ?? null;
    }

    getItemAndTimestamp(key: string): { data: any | null, lastUpdated: number | null } {
        const data = this.getItem(key);
        const lastUpdated = this.getItemLastUpdated(key);
        return { data, lastUpdated };
    }

    setItem(key: string, value?: any): void {
        if (value !== undefined) {
            this.data.set(key, value);
        }
        this.timestamps.set(key, this.clock.now());
    }

    clear(): void {
        this.data.clear();
        this.timestamps.clear();
    }
}
