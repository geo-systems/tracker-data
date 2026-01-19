import fs from 'fs';
import type { Clock } from '../common/Clock.ts';
import { SystemClock } from '../common/SystemClock.ts';
import type { Register } from './Register.ts';

export class RegisterFS implements Register {
    private readonly registerFilePath: string;
    private readonly dataDir: string;
    private readonly clock: Clock;

    constructor(dataDir: string = './data', clock: Clock = new SystemClock()) {
        this.dataDir = dataDir;
        this.registerFilePath = `${dataDir}/register/register.json`;
        this.clock = clock;
    }

    getItemLastUpdated(key: string): any {
        if (!fs.existsSync(this.registerFilePath)) {
            return null;
        }
        const register = JSON.parse(fs.readFileSync(this.registerFilePath, 'utf-8'));
        return register[key] || null;
    }

    getItem(key: string): any {
        const keyFile = `${this.dataDir}/${key}.json`;
        if (!fs.existsSync(keyFile)) {
            return null;
        }
        return JSON.parse(fs.readFileSync(keyFile, 'utf-8'));
    }

    getItemAndTimestamp(key: string): { data: any | null, lastUpdated: number | null } {
        const data = this.getItem(key);
        const lastUpdated = this.getItemLastUpdated(key);
        return { data, lastUpdated };
    }

    setItem(key: string, value?: any): void {
        if (value != undefined) {
            const keyFile = `${this.dataDir}/${key}.json`;
            fs.writeFileSync(keyFile, JSON.stringify(value, null, 2), 'utf-8');
        }

        let register: any = {};
        if (fs.existsSync(this.registerFilePath)) {
            register = JSON.parse(fs.readFileSync(this.registerFilePath, 'utf-8'));
        }
        register[key] = this.clock.now();
        fs.writeFileSync(this.registerFilePath, JSON.stringify(register, null, 2), 'utf-8');
    }
}