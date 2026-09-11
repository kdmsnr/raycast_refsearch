import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  Keyboard,
  List,
  openExtensionPreferences,
  useNavigation,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useRef, useState } from "react";
import { searchPage, type SearchRecord } from "../lib/api";
import { recordMarkdown } from "../lib/markdown";
import {
  DATA_TYPES,
  HELP_URL,
  MATCH_MODES,
  PAGE_SIZE,
  SORTS,
  buildQuery,
  buildSearchUrl,
  describeCriteria,
  type DataType,
  type SearchCriteria,
} from "../lib/query";
import { SearchForm } from "./search-form";

const RECORD_ICONS = {
  reference: Icon.SpeechBubble,
  manual: Icon.Book,
  collection: Icon.Bookmark,
  profile: Icon.Building,
};

export function SearchResults({ initialCriteria }: { initialCriteria: SearchCriteria }) {
  const [criteria, setCriteria] = useState(initialCriteria);
  const abortable = useRef<AbortController | null>(null);
  const { push, pop } = useNavigation();
  const query = buildQuery(criteria);
  const requestKey = query ? buildSearchUrl(criteria) : "";
  const hasFieldConditions = Object.entries(criteria.fields).some(
    ([field, value]) => field !== "anywhere" && value?.trim(),
  );

  const { data, error, isLoading, pagination, revalidate } = usePromise(
    (criteria: SearchCriteria, key: string) =>
      async ({ page }: { page: number }) => {
        const result = await searchPage(criteria, "", page * PAGE_SIZE + 1, { signal: abortable.current?.signal });
        return { data: [{ ...result, requestKey: key }], hasMore: result.hasMore };
      },
    [criteria, requestKey],
    { execute: Boolean(query), abortable, failureToastOptions: { title: "検索できませんでした" } },
  );

  // Do not display old results while a different query is loading or the search bar is cleared.
  const pages = query ? (data ?? []).filter((page) => page.requestKey === requestKey) : [];
  const records = [...new Map(pages.flatMap((page) => page.records).map((record) => [record.id, record])).values()];
  const total = pages[0]?.total;
  const summary = describeCriteria(criteria);

  function editConditions() {
    push(
      <SearchForm
        initialCriteria={criteria.type === "all" ? { ...criteria, type: "reference" } : criteria}
        onSubmit={(next) => {
          setCriteria(next);
          pop();
        }}
      />,
    );
  }

  function actions(record?: SearchRecord, fullDetail = false) {
    return (
      <ActionPanel>
        {record ? (
          <ActionPanel.Section>
            <Action.OpenInBrowser title="レファ協で開く" url={record.url} />
            {!fullDetail ? (
              <Action.Push
                title="詳細を読む"
                icon={Icon.Document}
                shortcut={Keyboard.Shortcut.Common.Open}
                target={
                  <Detail
                    navigationTitle={record.title}
                    markdown={recordMarkdown(record)}
                    actions={actions(record, true)}
                  />
                }
              />
            ) : null}
            <Action.CopyToClipboard
              title="URLをコピー"
              content={record.url}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.CopyToClipboard
              title="タイトル・提供館・URLをコピー"
              content={`${record.title}\n提供館：${record.library}\n${record.url}`}
              shortcut={Keyboard.Shortcut.Common.Copy}
            />
          </ActionPanel.Section>
        ) : null}
        {!fullDetail ? (
          <ActionPanel.Section>
            <Action
              title="検索条件を編集"
              icon={Icon.Pencil}
              shortcut={Keyboard.Shortcut.Common.Edit}
              onAction={editConditions}
            />
            {query ? (
              <Action
                title="検索をやり直す"
                icon={Icon.ArrowClockwise}
                shortcut={Keyboard.Shortcut.Common.Refresh}
                onAction={() => {
                  void revalidate();
                }}
              />
            ) : null}
            {query ? <Action.CopyToClipboard title="検索APIのURLをコピー" content={requestKey} /> : null}
            {query ? <Action.CopyToClipboard title="CQLをコピー" content={query} /> : null}
          </ActionPanel.Section>
        ) : null}
        <ActionPanel.Section>
          <Action title="拡張の設定を開く" icon={Icon.Gear} onAction={openExtensionPreferences} />
          <Action.OpenInBrowser title="APIの利用案内を開く" url={HELP_URL} />
        </ActionPanel.Section>
      </ActionPanel>
    );
  }

  return (
    <List
      navigationTitle={`レファ協 — ${DATA_TYPES[criteria.type]}`}
      searchBarPlaceholder={
        hasFieldConditions ? "全項目のキーワードでさらに絞り込む…" : "キーワードで検索（例：江戸 食文化）…"
      }
      searchText={criteria.fields.anywhere ?? ""}
      onSearchTextChange={(anywhere) =>
        setCriteria((previous) => ({ ...previous, fields: { ...previous.fields, anywhere } }))
      }
      throttle
      filtering={false}
      isLoading={Boolean(query) && isLoading}
      isShowingDetail={records.length > 0}
      pagination={query && !error && pagination ? { ...pagination, pageSize: PAGE_SIZE } : undefined}
      searchBarAccessory={
        !hasFieldConditions ? (
          <List.Dropdown
            tooltip="検索対象"
            value={criteria.type}
            onChange={(type) => setCriteria((previous) => ({ ...previous, type: type as DataType }))}
          >
            {Object.entries(DATA_TYPES).map(([value, title]) => (
              <List.Dropdown.Item key={value} value={value} title={title} />
            ))}
          </List.Dropdown>
        ) : undefined
      }
      actions={actions()}
    >
      <List.EmptyView
        icon={error && query ? Icon.ExclamationMark : Icon.MagnifyingGlass}
        title={
          !query
            ? "レファレンス協同データベースを検索"
            : error
              ? "検索できませんでした"
              : isLoading
                ? "検索しています…"
                : "該当するデータがありません"
        }
        description={
          !query
            ? "キーワードを入力するか、⌘Eで質問・回答などの条件を指定できます。出典：レファレンス協同データベース API 2.0"
            : error
              ? error.message
              : isLoading
                ? summary
                : "検索条件を減らすか、別のキーワードを試してください。⌘Eで条件を編集できます。"
        }
        actions={actions()}
      />
      {records.length > 0 ? (
        <List.Section
          title={summary}
          subtitle={`${total?.toLocaleString("ja-JP")}件中 ${records.length}件 · ${SORTS[criteria.sort]}`}
        >
          {records.map((record) => (
            <List.Item
              key={record.id}
              id={record.id}
              title={record.title.replace(/\s+/gu, " ")}
              subtitle={record.library}
              icon={RECORD_ICONS[record.type]}
              detail={
                <List.Item.Detail
                  markdown={recordMarkdown(record)}
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.Label title="提供館" text={record.library} />
                      <List.Item.Detail.Metadata.Label title="データ種別" text={DATA_TYPES[record.type]} />
                      {record.updatedAt ? (
                        <List.Item.Detail.Metadata.Label title="最終更新日" text={record.updatedAt} />
                      ) : null}
                      {record.keywords.length > 0 ? (
                        <List.Item.Detail.Metadata.TagList title="キーワード">
                          {[...new Set(record.keywords)].map((keyword) => (
                            <List.Item.Detail.Metadata.TagList.Item key={keyword} text={keyword} />
                          ))}
                        </List.Item.Detail.Metadata.TagList>
                      ) : null}
                      {record.classifications.length > 0 ? (
                        <List.Item.Detail.Metadata.Label title="NDC" text={record.classifications.join(" / ")} />
                      ) : null}
                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label
                        title="各項目の一致条件"
                        text={MATCH_MODES[criteria.matchMode]}
                      />
                      <List.Item.Detail.Metadata.Link title="出典" text="レファ協 API 2.0" target={HELP_URL} />
                    </List.Item.Detail.Metadata>
                  }
                />
              }
              actions={actions(record)}
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}
