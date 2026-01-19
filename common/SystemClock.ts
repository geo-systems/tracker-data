import type { Clock } from "./Clock.ts";

export class SystemClock implements Clock {
    now(): number {
        return Date.now();
    }

    sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
