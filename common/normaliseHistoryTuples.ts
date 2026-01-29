import _ from "lodash";
import { DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS, roundToNearest } from "./date.ts";

const calculateRoundingKey = (ts: number, now: number): string => {
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
  return result.map(({ ts, price, iso }) => ([ts, price, iso]));
};
