import { useNavigation } from "@raycast/api";
import { SearchForm } from "./components/search-form";
import { SearchResults } from "./components/search-results";
import { defaultCriteria } from "./lib/preferences";

export default function Command() {
  const { push } = useNavigation();
  return (
    <SearchForm
      initialCriteria={defaultCriteria("reference")}
      onSubmit={(criteria) => push(<SearchResults initialCriteria={criteria} />)}
    />
  );
}
