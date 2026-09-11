export const API_URL = "https://crd.ndl.go.jp/api/refsearch";
export const HELP_URL = "https://crd.ndl.go.jp/jp/help/general/help_07.html";
export const PAGE_SIZE = 50;

export const DATA_TYPES = {
  all: "すべて",
  reference: "レファレンス事例",
  manual: "調べ方マニュアル",
  collection: "特別コレクション",
  profile: "参加館プロファイル",
} as const;

export type DataType = keyof typeof DATA_TYPES;
export type RecordType = Exclude<DataType, "all">;
export type MatchMode = "all" | "any" | "phrase";
export type Sort = "fit" | "lst-date" | "reg-date" | "access-num";

export const MATCH_MODES: Record<MatchMode, string> = {
  all: "すべての語を含む（AND）",
  any: "いずれかの語を含む（OR）",
  phrase: "フレーズ一致",
};

export const SORTS: Record<Sort, string> = {
  fit: "適合度が高い順",
  "lst-date": "更新が新しい順",
  "reg-date": "登録が新しい順",
  "access-num": "アクセス数が多い順",
};

export const FIELDS = {
  anywhere: { title: "全項目", placeholder: "すべての項目から探す" },
  question: { title: "質問", placeholder: "例：本" },
  answer: { title: "回答", placeholder: "例：村上春樹" },
  theme: { title: "調査テーマ", placeholder: "例：新聞記事" },
  guide: { title: "調べ方", placeholder: "例：データベース" },
  "col-name": { title: "コレクション名", placeholder: "例：浮世絵" },
  outline: { title: "内容・沿革", placeholder: "内容や沿革に含む語" },
  "lib-name": { title: "提供館・図書館名", placeholder: "例：国立国会図書館" },
  keyword: { title: "キーワード", placeholder: "登録されたキーワードから探す" },
  ndc: { title: "NDC", placeholder: "例：913" },
  address: { title: "住所", placeholder: "例：東京都" },
  feature: { title: "特色", placeholder: "例：郷土資料" },
} as const;

export type SearchField = keyof typeof FIELDS;

export const TYPE_FIELDS: Record<DataType, SearchField[]> = {
  all: ["anywhere"],
  reference: ["question", "answer", "anywhere", "lib-name", "keyword", "ndc"],
  manual: ["theme", "guide", "anywhere", "lib-name", "keyword", "ndc"],
  collection: ["col-name", "outline", "anywhere", "lib-name", "keyword", "ndc"],
  profile: ["lib-name", "address", "feature", "anywhere", "outline"],
};

export interface SearchCriteria {
  type: DataType;
  fields: Partial<Record<SearchField, string>>;
  matchMode: MatchMode;
  sort: Sort;
}

export function normalizeTerm(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function quoteTerm(value: string): string {
  return `"${normalizeTerm(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Field names and operators come from the form, never from the user's text. */
export function buildQuery(criteria: SearchCriteria, additionalText = ""): string {
  const operator = criteria.matchMode === "phrase" ? "=" : criteria.matchMode;
  const clauses: string[] = [];
  for (const [field, value] of Object.entries(criteria.fields)) {
    if (!normalizeTerm(value)) continue;
    if (!TYPE_FIELDS[criteria.type].includes(field as SearchField)) {
      throw new Error(`${DATA_TYPES[criteria.type]}では「${field}」を検索できません。`);
    }
  }
  for (const field of TYPE_FIELDS[criteria.type]) {
    const value = criteria.fields[field];
    if (value && normalizeTerm(value)) clauses.push(`${field} ${operator} ${quoteTerm(value)}`);
  }
  if (normalizeTerm(additionalText)) clauses.push(`anywhere ${operator} ${quoteTerm(additionalText)}`);
  return clauses.join(" and ");
}

export function buildSearchUrl(
  criteria: SearchCriteria,
  additionalText = "",
  position = 1,
  pageSize = PAGE_SIZE,
): string {
  const query = buildQuery(criteria, additionalText);
  if (!query) throw new Error("検索条件を1つ以上入力してください。");
  if (!Number.isSafeInteger(position) || position < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error("検索結果の取得位置と件数は1以上の整数で指定してください。");
  }
  const params = new URLSearchParams({
    type: criteria.type,
    query,
    results_format: "xml",
    results_get_position: String(position),
    results_num: String(pageSize),
    sort: criteria.sort,
    sort_order: "desc",
  });
  return `${API_URL}?${params.toString()}`;
}

export function describeCriteria(criteria: SearchCriteria): string {
  return TYPE_FIELDS[criteria.type]
    .flatMap((field) => {
      const value = normalizeTerm(criteria.fields[field] ?? "");
      return value ? [`${FIELDS[field].title}「${value}」`] : [];
    })
    .join(" かつ ");
}
