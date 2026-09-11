import { XMLParser, XMLValidator } from "fast-xml-parser";
import { buildSearchUrl, PAGE_SIZE, type RecordType, type SearchCriteria } from "./query";

type XmlNode = Record<string, unknown>;

export interface ContentSection {
  title: string;
  text: string;
}

export interface SearchRecord {
  id: string;
  type: RecordType;
  title: string;
  library: string;
  url: string;
  updatedAt: string;
  keywords: string[];
  classifications: string[];
  sections: ContentSection[];
}

export interface SearchPage {
  records: SearchRecord[];
  total: number;
  position: number;
  hasMore: boolean;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

function node(value: unknown): XmlNode {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as XmlNode) : {};
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return textNode(value);
}

function textNode(value: unknown): string {
  const content = node(value)["#text"];
  return typeof content === "string" ? content.trim() : "";
}

function array(value: unknown): unknown[] {
  return value == null || value === "" ? [] : Array.isArray(value) ? value : [value];
}

function strings(value: unknown): string[] {
  return array(value).map(text).filter(Boolean);
}

const SECTION_FIELDS: Record<RecordType, [string, string][]> = {
  reference: [
    ["answer", "回答"],
    ["ans-proc", "回答プロセス"],
    ["pre-res", "事前調査事項"],
    ["referral", "照会先"],
    ["contri", "寄与者"],
    ["note", "備考"],
  ],
  manual: [
    ["guide", "調べ方"],
    ["note", "備考"],
  ],
  collection: [
    ["outline", "内容"],
    ["origin", "来歴"],
    ["restriction", "利用条件"],
    ["catalog", "目録等"],
    ["literature", "紹介文献"],
    ["number", "所蔵点数"],
    ["note", "備考"],
  ],
  profile: [
    ["feature", "特色"],
    ["open-info", "開館情報"],
    ["restriction", "利用条件"],
    ["outline", "沿革"],
    ["notes", "注意事項"],
    ["access", "交通アクセス"],
    ["lib-url", "図書館のURL"],
  ],
};

const TITLE_FIELDS: Record<RecordType, string> = {
  reference: "question",
  manual: "theme",
  collection: "col-name",
  profile: "lib-name",
};

function recordUrl(value: unknown): string {
  try {
    const url = new URL(text(value));
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.hostname !== "crd.ndl.go.jp" ||
      url.username ||
      url.password
    ) {
      throw new Error();
    }
    url.protocol = "https:";
    return url.toString();
  } catch {
    throw new Error("APIの検索結果に有効なレファ協のURLがありません。");
  }
}

export function formatDate(value: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  return match && !value.startsWith("00000000") ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function parseRecord(value: unknown): SearchRecord {
  const result = node(value);
  const type = (Object.keys(TITLE_FIELDS) as RecordType[]).find((key) => result[key]);
  if (!type) throw new Error("APIから未対応のデータ種別が返されました。");
  const entry = node(result[type]);
  const system = node(entry.system);
  const library = text(system["lib-name"]) || text(entry["lib-name"]);
  const title = text(entry[TITLE_FIELDS[type]]);
  if (!title || !library) throw new Error("APIの検索結果にタイトルまたは提供館名がありません。");
  const url = recordUrl(entry.url);
  const sections: ContentSection[] = SECTION_FIELDS[type].flatMap(([field, label]) => {
    const content = strings(entry[field]).join("\n\n");
    return content ? [{ title: label, text: content }] : [];
  });
  const bibliography = array(entry.bibl).flatMap((value) => {
    const item = node(value);
    const parts = [
      text(item["bibl-desc"]),
      text(item["bibl-isbn"]) && `ISBN: ${text(item["bibl-isbn"])}`,
      text(item["bibl-note"]),
    ];
    const content = parts.filter(Boolean).join("\n");
    return content ? [content] : [];
  });
  if (bibliography.length) sections.push({ title: "参考資料", text: bibliography.join("\n\n") });
  if (type === "profile") {
    const address = [entry["add-pref"], entry["add-city"], entry["add-street"]].map(text).join("");
    if (address) sections.push({ title: "住所", text: address });
  }
  return {
    id: `${type}:${text(system["sys-id"]) || text(system["lib-id"]) || url}`,
    type,
    title,
    library,
    url,
    updatedAt: formatDate(text(system["lst-date"])),
    keywords: strings(entry.keyword),
    classifications: strings(entry.class),
    sections,
  };
}

function integer(value: unknown, minimum: number): number {
  const raw = text(value);
  const parsed = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error("APIの検索件数または取得位置を読み取れませんでした。");
  }
  return parsed;
}

export function parseSearchResponse(xml: string): SearchPage {
  if (/<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw new Error("APIから正しいXMLが返されませんでした。時間をおいて再試行してください。");
  }
  const root = node(node(parser.parse(xml)).result_set);
  const code = text(root.results_cd);
  if (code === "1") {
    const messages = array(node(root.err_list).err_item)
      .map((item) => {
        const error = node(item);
        return [text(error.err_msg), text(error.err_code) && `(${text(error.err_code)})`].filter(Boolean).join(" ");
      })
      .filter(Boolean);
    throw new Error(messages.join("\n") || "APIが検索条件を受け付けませんでした。");
  }
  if (code !== "0") throw new Error("APIから想定外の応答が返されました。時間をおいて再試行してください。");
  const total = integer(root.hit_num, 0);
  const position = integer(root.results_get_position, 1);
  const records = array(root.result).map(parseRecord);
  return { records, total, position, hasMore: records.length > 0 && position - 1 + records.length < total };
}

/** Pure HTTP/XML boundary: no Raycast or GUI dependency, also used by the smoke test. */
export async function searchPage(
  criteria: SearchCriteria,
  additionalText = "",
  position = 1,
  options: { signal?: AbortSignal; pageSize?: number; timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<SearchPage> {
  const url = buildSearchUrl(criteria, additionalText, position, options.pageSize ?? PAGE_SIZE);
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      signal,
      headers: { Accept: "application/xml, text/xml" },
    });
    if (!response.ok)
      throw new Error(`検索APIに接続できませんでした（HTTP ${response.status}）。時間をおいて再試行してください。`);
    const result = parseSearchResponse(await response.text());
    if (result.position !== position)
      throw new Error("APIから異なる取得位置の結果が返されました。検索をやり直してください。");
    return result;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timeout.aborted) throw new Error("検索がタイムアウトしました。再試行してください。");
    if (error instanceof TypeError)
      throw new Error("検索APIに接続できませんでした。ネットワーク接続を確認してください。");
    throw error;
  }
}
