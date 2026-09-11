import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseSearchResponse, searchPage } from "../src/lib/api";
import { recordMarkdown } from "../src/lib/markdown";
import { type SearchCriteria } from "../src/lib/query";

const fixture = readFileSync(join(__dirname, "fixtures/results.xml"), "utf8");
const criteria: SearchCriteria = { type: "all", fields: { anywhere: "読書" }, matchMode: "all", sort: "fit" };
const empty =
  "<result_set><hit_num>0</hit_num><results_get_position>1</results_get_position><results_num>0</results_num><results_cd>0</results_cd></result_set>";
const one = fixture
  .replace(/<hit_num>4<\/hit_num>/, "<hit_num>100</hit_num>")
  .replace(/(<\/result>)[\s\S]*<\/result_set>/, "$1</result_set>");

test("4種別のXMLを読み取り、タイトル・提供館・本文・URLを保つ", () => {
  const page = parseSearchResponse(fixture);
  assert.equal(page.total, 4);
  assert.equal(page.hasMore, false);
  assert.deepEqual(
    page.records.map((record) => record.type),
    ["reference", "manual", "collection", "profile"],
  );
  assert.equal(page.records[0].title, "本 & 読書について知りたい");
  assert.equal(page.records[0].library, "テスト図書館");
  assert.equal(new URL(page.records[0].url).searchParams.get("id"), "0001");
  assert.equal(page.records[0].updatedAt, "2026-09-11");
  assert.match(page.records[0].sections[0].text, /\n次の行には <資料名>/);
  assert.equal(page.records[1].updatedAt, "");
  assert.equal(page.records[1].sections[0].text, "索引を使う。");
  assert.equal(page.records[2].sections[0].text, "地域の資料。");
  assert.equal(page.records[3].id, "profile:0004");
  assert.equal(page.records[3].library, "テスト大学図書館");
  assert.equal(page.records[3].sections.find((section) => section.title === "住所")?.text, "東京都架空区1-2-3");
});

test("単一・繰り返し項目と、NDC・ISBNの先頭の0を保つ", () => {
  const { records } = parseSearchResponse(fixture);
  assert.deepEqual(records[0].classifications, ["019", "913.6"]);
  assert.deepEqual(records[1].keywords, ["新聞"]);
  assert.deepEqual(records[2].keywords, []);
  const bibliography = records[0].sections.find((section) => section.title === "参考資料")?.text;
  assert.match(bibliography ?? "", /ISBN: 0000000000001/);
  assert.match(bibliography ?? "", /別の参考図書/);
});

test("結果1件でも配列にし、実際の返却件数から次ページを判定する", () => {
  const page = parseSearchResponse(one);
  assert.equal(page.records.length, 1);
  assert.equal(page.hasMore, true);
  assert.equal(
    parseSearchResponse(one.replace("<results_get_position>1<", "<results_get_position>100<")).hasMore,
    false,
  );
});

test("結果0件と取得位置が末尾を超えた場合は追加取得しない", () => {
  assert.deepEqual(parseSearchResponse(empty), { records: [], total: 0, position: 1, hasMore: false });
  assert.equal(
    parseSearchResponse(
      empty.replace("<hit_num>0<", "<hit_num>5<").replace("<results_get_position>1<", "<results_get_position>51<"),
    ).hasMore,
    false,
  );
});

test("HTTP成功でもAPI内部のエラーをメッセージ付きで通知する", () => {
  const xml =
    "<result_set><results_cd>1</results_cd><err_list><err_item><err_code>0309</err_code><err_msg>検索項目が不正です。</err_msg></err_item><err_item><err_msg>条件を変更してください。</err_msg></err_item></err_list></result_set>";
  assert.throws(() => parseSearchResponse(xml), /検索項目が不正です。 \(0309\)\n条件を変更/);
});

test("壊れたXML、メンテナンスHTML、DTD、不正な件数を拒否する", () => {
  assert.throws(() => parseSearchResponse("<result_set>"), /正しいXML/);
  assert.throws(() => parseSearchResponse("<html><body>Maintenance</body></html>"), /想定外/);
  assert.throws(() => parseSearchResponse('<!DOCTYPE root [<!ENTITY x "expanded">]>' + empty), /正しいXML/);
  assert.throws(() => parseSearchResponse(empty.replace("<hit_num>0<", "<hit_num>NaN<")), /検索件数/);
});

test("提供館名の欠落や不正なリンクを黙って表示しない", () => {
  assert.throws(() => parseSearchResponse(one.replace("<lib-name>テスト図書館</lib-name>", "")), /提供館名/);
  assert.throws(
    () => parseSearchResponse(one.replace("https://crd.ndl.go.jp/reference/detail", "javascript:alert")),
    /URL/,
  );
  assert.throws(
    () => parseSearchResponse(one.replace("https://crd.ndl.go.jp/reference/detail", "https://example.com/detail")),
    /URL/,
  );
});

test("プレビューには提供館と出典を表示し、外部画像を埋め込まない", () => {
  const record = parseSearchResponse(fixture).records[0];
  const markdown = recordMarkdown({
    ...record,
    title: "![track](https://example.com/image.png)",
    sections: [{ title: "回答", text: "<img src='https://example.com/a'>\n[リンク](javascript:bad)" }],
  });
  assert.ok(markdown.includes("提供館：テスト図書館"));
  assert.ok(markdown.includes("レファレンス協同データベース API 2.0"));
  assert.ok(!markdown.includes("![track]("));
  assert.ok(!markdown.includes("<img"));
});

test("HTTPレスポンスをXMLとして処理する", async () => {
  const result = await searchPage(criteria, "", 1, {
    fetcher: async (url, options) => {
      assert.equal(new URL(String(url)).searchParams.get("query"), 'anywhere all "読書"');
      assert.ok(options?.signal);
      return new Response(fixture);
    },
  });
  assert.equal(result.records.length, 4);
});

test("HTTPエラー、ネットワークエラー、取得位置の不一致を区別する", async () => {
  await assert.rejects(
    searchPage(criteria, "", 1, { fetcher: async () => new Response("unavailable", { status: 503 }) }),
    /HTTP 503/,
  );
  await assert.rejects(
    searchPage(criteria, "", 1, {
      fetcher: async () => {
        throw new TypeError("fetch failed");
      },
    }),
    /ネットワーク/,
  );
  await assert.rejects(searchPage(criteria, "", 51, { fetcher: async () => new Response(fixture) }), /異なる取得位置/);
});

test("タイムアウトは再試行を案内し、キャンセルはそのまま呼び出し元へ返す", async () => {
  const waitForAbort: typeof fetch = async (_url, options) =>
    new Promise((_resolve, reject) => {
      const signal = options?.signal;
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const timer = setTimeout(() => reject(new Error("Unexpected test timeout")), 1000);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  await assert.rejects(searchPage(criteria, "", 1, { timeoutMs: 5, fetcher: waitForAbort }), /タイムアウト/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(searchPage(criteria, "", 1, { signal: controller.signal, fetcher: waitForAbort }), {
    name: "AbortError",
  });
});
