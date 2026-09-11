import { getPreferenceValues } from "@raycast/api";
import { type MatchMode, type SearchCriteria, type Sort } from "./query";

export function defaultCriteria(type: SearchCriteria["type"]): SearchCriteria {
  const preferences = getPreferenceValues<{ matchMode?: MatchMode; sort?: Sort }>();
  return { type, fields: {}, matchMode: preferences.matchMode ?? "all", sort: preferences.sort ?? "fit" };
}
