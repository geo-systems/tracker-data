import type { Clock } from "./Clock.ts";

export class MockClock implements Clock {
    private _now: number;
    public sleepCalls: number[] = [];

    constructor(now: number = Date.now()) {
        this._now = now;
    }

    now(): number {
        return this._now;
    }

    setNow(now: number): void {
        this._now = now;
    }

    sleep(ms: number): Promise<void> {
        this.sleepCalls.push(ms);
        return Promise.resolve();
    }
}
