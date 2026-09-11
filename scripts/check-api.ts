import assert from "node:assert/strict";
import { searchPage } from "../src/lib/api";
import { type SearchCriteria } from "../src/lib/query";

// Opt-in, read-only requests. Does not load Raycast or operate any GUI.
async function main() {
  const cases: SearchCriteria[] = [
    { type: "reference", fields: { question: "本", answer: "村上春樹" }, matchMode: "any", sort: "fit" },
    ...(["all", "manual", "collection", "profile"] as const).map((type) => ({
      type,
      fields: { anywhere: type === "profile" ? "国立国会図書館" : "図書館" },
      matchMode: "all" as const,
      sort: "fit" as const,
    })),
  ];
  for (const criteria of cases) {
    const page = await searchPage(criteria, "", 1, { pageSize: 2 });
    assert.ok(page.total > 0);
    assert.ok(page.records.length > 0 && page.records.length <= 2);
    assert.ok(page.records.every((record) => record.title && record.library && record.url));
    if (criteria.type !== "all") assert.ok(page.records.every((record) => record.type === criteria.type));
    console.log(`${criteria.type}: ${page.total} hits, ${page.records.length} records parsed`);
    if (criteria.type === "reference" && page.hasMore) {
      const next = await searchPage(criteria, "", 3, { pageSize: 2 });
      assert.equal(next.position, 3);
      assert.ok(next.records.every((record) => !page.records.some((previous) => previous.id === record.id)));
      console.log("reference: second page parsed without duplicate records");
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
