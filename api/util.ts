import _ from "lodash";
import { DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS, roundToNearest } from "./date.ts";

export const ensureArray = <T>(obj: T | T[]): T[] => {
    if (Array.isArray(obj)) {
        return obj;
    } else {
        return [obj];
    }
}

export const normaliseHistoryTuples = (data: Array<[number, number]>) => {
  const now = Date.now();
  let result = data.map((item) => {
    const ts = item[0];
    const price = item[1];
    let key = new Date(roundToNearest(ts, MINUTE_IN_MS, 10)).toISOString();
    if (now - ts > DAY_IN_MS * 90) {
        key = new Date(roundToNearest(ts, DAY_IN_MS, 7)).toISOString();
    } else if (now - ts > DAY_IN_MS * 30) {
        key = new Date(roundToNearest(ts, DAY_IN_MS, 1)).toISOString();
    } else if (now - ts > DAY_IN_MS * 7) {
        key = new Date(roundToNearest(ts, HOUR_IN_MS, 1)).toISOString();
    } else if (now - ts > DAY_IN_MS * 2) {
        key = new Date(roundToNearest(ts, MINUTE_IN_MS, 30)).toISOString();
    }
    return {
      ts,
      price,
      iso: new Date(ts).toISOString(),
      key,
    };
  });
  result = result.filter(r => r.price ?? 0 > 0);
  result = _.orderBy(result, ['ts'], ['desc']);
  result = _.uniqBy(result, 'key');
  return result.map(({ ts, price, iso }) => ([ts, price, iso]));
};