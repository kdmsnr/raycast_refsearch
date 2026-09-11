import { Action, ActionPanel, Form, Icon } from "@raycast/api";
import { useState } from "react";
import {
  DATA_TYPES,
  FIELDS,
  MATCH_MODES,
  SORTS,
  TYPE_FIELDS,
  buildQuery,
  describeCriteria,
  type DataType,
  type MatchMode,
  type SearchCriteria,
  type SearchField,
  type Sort,
} from "../lib/query";

export function SearchForm({
  initialCriteria,
  onSubmit,
}: {
  initialCriteria: SearchCriteria;
  onSubmit: (criteria: SearchCriteria) => void;
}) {
  const [type, setType] = useState(initialCriteria.type);
  const [fields, setFields] = useState(initialCriteria.fields);
  const [matchMode, setMatchMode] = useState(initialCriteria.matchMode);
  const [sort, setSort] = useState(initialCriteria.sort);
  const [error, setError] = useState<string>();
  // A type change only submits fields supported by the new type. Hidden inputs stay editable when switching back.
  const criteria: SearchCriteria = {
    type,
    fields: Object.fromEntries(TYPE_FIELDS[type].map((field) => [field, fields[field] ?? ""])),
    matchMode,
    sort,
  };

  function updateField(field: SearchField, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }));
    setError(undefined);
  }

  function submit() {
    if (!buildQuery(criteria)) {
      setError("検索条件を1つ以上入力してください。");
      return;
    }
    onSubmit(criteria);
  }

  return (
    <Form
      navigationTitle="条件を指定して検索"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="この条件で検索" icon={Icon.MagnifyingGlass} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="type"
        title="検索対象"
        value={type}
        onChange={(value) => {
          setType(value as DataType);
          setError(undefined);
        }}
      >
        {Object.entries(DATA_TYPES).map(([value, title]) => (
          <Form.Dropdown.Item key={value} value={value} title={title} />
        ))}
      </Form.Dropdown>
      <Form.Description text="入力した項目を「かつ（AND）」で組み合わせます。空欄の項目は条件に含めません。" />
      {TYPE_FIELDS[type].map((field, index) => (
        <Form.TextField
          key={field}
          id={field}
          title={FIELDS[field].title}
          placeholder={FIELDS[field].placeholder}
          value={fields[field] ?? ""}
          onChange={(value) => updateField(field, value)}
          error={index === 0 ? error : undefined}
        />
      ))}
      <Form.Separator />
      <Form.Dropdown
        id="matchMode"
        title="各項目の一致条件"
        value={matchMode}
        onChange={(value) => setMatchMode(value as MatchMode)}
      >
        {Object.entries(MATCH_MODES).map(([value, title]) => (
          <Form.Dropdown.Item key={value} value={value} title={title} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown id="sort" title="並び順" value={sort} onChange={(value) => setSort(value as Sort)}>
        {Object.entries(SORTS).map(([value, title]) => (
          <Form.Dropdown.Item key={value} value={value} title={title} />
        ))}
      </Form.Dropdown>
      <Form.Description
        title="検索する条件"
        text={describeCriteria(criteria) || "上の項目にキーワードを入力してください。"}
      />
      <Form.Description title="出典" text="レファレンス協同データベース API 2.0（国立国会図書館）" />
    </Form>
  );
}
