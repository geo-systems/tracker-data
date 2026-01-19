import { DAY_IN_MS } from "../common/date.ts";
import { getSupportedCoins } from "../api/gecko.ts";
import type { Register } from "../register/Register.ts";
import { RegisterFS } from "../register/RegisterFS.ts";
import type { Clock } from "../common/Clock.ts";
import { SystemClock } from "../common/SystemClock.ts";
import type Job from "./Job.ts";

export const SUPPORTED_ASSETS_REG_KEY = "supported-assets";

export class GeckoSupportedAssetsJob implements Job {
    private readonly clock: Clock;
    private readonly register: Register;

    constructor(register: Register = new RegisterFS(), clock: Clock = new SystemClock()) {
        this.register = register;
        this.clock = clock;
    }

    async run(): Promise<void> {
        const { data, lastUpdated } = this.register.getItemAndTimestamp(SUPPORTED_ASSETS_REG_KEY);

        if (data && lastUpdated && (this.clock.now() - lastUpdated) < DAY_IN_MS) {
            console.log("Supported assets are up to date.");
            return;
        }
        const updatedCoins = await getSupportedCoins(this.clock);
        console.log(`Fetched ${Object.keys(updatedCoins).length} supported assets from Gecko.`);
        this.register.setItem(SUPPORTED_ASSETS_REG_KEY, {...data, ...updatedCoins});
    }
}