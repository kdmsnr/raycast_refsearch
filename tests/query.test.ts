import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuery, buildSearchUrl, describeCriteria, type SearchCriteria } from "../src/lib/query";

const criteria: SearchCriteria = {
  type: "reference",
  fields: { question: "本", answer: "村上春樹" },
  matchMode: "any",
  sort: "fit",
};

test("質問と回答をANDで結合し、公式の複合検索例を生成する", () => {
  assert.equal(buildQuery(criteria), 'question any "本" and answer any "村上春樹"');
  const url = new URL(buildSearchUrl(criteria));
  assert.equal(url.origin + url.pathname, "https://crd.ndl.go.jp/api/refsearch");
  assert.equal(url.searchParams.get("query"), 'question any "本" and answer any "村上春樹"');
  assert.equal(url.searchParams.get("type"), "reference");
  assert.equal(url.searchParams.get("results_num"), "50");
  assert.equal(describeCriteria(criteria), "質問「本」 かつ 回答「村上春樹」");
});

test("全角空白、改行、連続空白を単語の区切りにする", () => {
  assert.equal(
    buildQuery({ ...criteria, fields: { anywhere: "  江戸　 食文化\n料理  " }, matchMode: "all" }),
    'anywhere all "江戸 食文化 料理"',
  );
});

test("フレーズ内の空白を引用符の内側に保つ", () => {
  assert.equal(
    buildQuery({ ...criteria, fields: { question: "朝の 読書" }, matchMode: "phrase" }),
    'question = "朝の 読書"',
  );
});

test("引用符やバックスラッシュ、演算子のような入力を検索語として扱う", () => {
  const malicious = '本" or answer any "*\\';
  assert.equal(
    buildQuery({ ...criteria, fields: { question: malicious } }),
    'question any "本\\" or answer any \\"*\\\\"',
  );
  const value = "A&B + C#D = 100%";
  const url = new URL(buildSearchUrl({ ...criteria, fields: { answer: value } }));
  assert.equal(url.searchParams.get("query"), `answer any "${value}"`);
  assert.equal(url.hash, "");
});

test("全種別検索ではanywhere以外を拒否する", () => {
  assert.throws(() => buildQuery({ ...criteria, type: "all" }), /検索できません/);
  assert.equal(
    buildQuery({ ...criteria, type: "all", fields: { anywhere: "読書", question: "  " } }),
    'anywhere any "読書"',
  );
});

test("空欄の条件を無視し、検索条件なしのAPI呼び出しを防ぐ", () => {
  assert.equal(buildQuery({ ...criteria, fields: { question: " ", answer: "村上春樹" } }), 'answer any "村上春樹"');
  assert.throws(() => buildSearchUrl({ ...criteria, fields: {} }), /1つ以上/);
});

test("種別に合う項目を組み合わせる", () => {
  assert.equal(
    buildQuery({ ...criteria, type: "manual", fields: { theme: "新聞", guide: "索引" } }),
    'theme any "新聞" and guide any "索引"',
  );
  assert.equal(
    buildQuery({ ...criteria, type: "collection", fields: { "col-name": "文庫", "lib-name": "京都" } }),
    'col-name any "文庫" and lib-name any "京都"',
  );
  assert.equal(
    buildQuery({ ...criteria, type: "profile", fields: { "lib-name": "大学", address: "東京" } }),
    'lib-name any "大学" and address any "東京"',
  );
});

test("追加キーワードも既存条件にANDで結合する", () => {
  assert.equal(buildQuery(criteria, "解説"), 'question any "本" and answer any "村上春樹" and anywhere any "解説"');
});

test("取得位置は1始まり、並び順と件数を明示する", () => {
  const url = new URL(buildSearchUrl({ ...criteria, sort: "lst-date" }, "", 51));
  assert.equal(url.searchParams.get("results_get_position"), "51");
  assert.equal(url.searchParams.get("results_format"), "xml");
  assert.equal(url.searchParams.get("sort"), "lst-date");
  assert.equal(url.searchParams.get("sort_order"), "desc");
  assert.throws(() => buildSearchUrl(criteria, "", 0), /1以上/);
  assert.throws(() => buildSearchUrl(criteria, "", 1, 0), /1以上/);
});
