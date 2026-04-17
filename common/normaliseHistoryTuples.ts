import _ from "lodash";
import { DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS, roundToNearest } from "./date.ts";

const calculateRoundingKey = (ts: number, now: number): string => {
  let key = new Date(roundToNearest(ts, MINUTE_IN_MS, 10)).toISOString();
  if (now - ts > DAY_IN_MS * 365 * 2) {
      // Over 2 years ago
      key = new Date(roundToNearest(ts, DAY_IN_MS, 14)).toISOString();
  } else if (now - ts > DAY_IN_MS * 365) {
      // Between 1 and 2 years ago
      key = new Date(roundToNearest(ts, DAY_IN_MS, 10)).toISOString();
  } else if (now - ts > DAY_IN_MS * 90) {
      // Between 3 months and 1 year ago
      key = new Date(roundToNearest(ts, DAY_IN_MS, 7)).toISOString();
  } else if (now - ts > DAY_IN_MS * 30) {
      // Between 1 and 3 months ago
      key = new Date(roundToNearest(ts, DAY_IN_MS, 1)).toISOString();
  } else if (now - ts > DAY_IN_MS * 7) {
      // Between 1 week and 1 month ago
      key = new Date(roundToNearest(ts, HOUR_IN_MS, 6)).toISOString();
  } else if (now - ts > DAY_IN_MS * 2) {
      // Between 2 days and 1 week ago
      key = new Date(roundToNearest(ts, HOUR_IN_MS, 3)).toISOString();
  } else if (now - ts > HOUR_IN_MS * 12) {
      // Between 12 hours and 2 days ago
      key = new Date(roundToNearest(ts, MINUTE_IN_MS, 30)).toISOString();
  } else if (now - ts > HOUR_IN_MS * 1) {
      // Between 1 hour and 12 hours ago
      key = new Date(roundToNearest(ts, MINUTE_IN_MS, 15)).toISOString();
  }

  // Less than 2 days ago
  return key;
};

export const normaliseFGITuples = <T>(data: Array<[number, number, string]>, now: number) => {
  let result = data.map((item) => {
    const ts = item[0];
    const idx = item[1];
    const state = item[2];
    const key = calculateRoundingKey(ts, now);
    return {
      ts,
      idx,
      state,
      iso: new Date(ts).toISOString(),
      key,
    };
  });
  result = _.orderBy(result, ['ts'], ['desc']);
  result = _.uniqBy(result, 'key');
  return result.map(({ ts, idx, state, iso }) => ([ts, idx, state, iso]));
};


export const normaliseHistoryTuples = <T>(data: Array<[number, T]>, now: number) => {
  let result = data.map((item) => {
    const ts = item[0];
    const price = item[1];
    const key = calculateRoundingKey(ts, now);
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
  return result.map(({ ts, price, iso, key }) => ([ts, price, iso]));
};
