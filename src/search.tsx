import { type LaunchProps } from "@raycast/api";
import { SearchResults } from "./components/search-results";
import { defaultCriteria } from "./lib/preferences";

export default function Command({ arguments: args }: LaunchProps<{ arguments: { query?: string } }>) {
  return <SearchResults initialCriteria={{ ...defaultCriteria("all"), fields: { anywhere: args.query ?? "" } }} />;
}
