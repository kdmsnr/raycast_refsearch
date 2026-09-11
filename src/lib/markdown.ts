import { type SearchRecord } from "./api";
import { DATA_TYPES, HELP_URL } from "./query";

// Treat database prose as text so Markdown-like titles cannot embed remote images.
export function escapeMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_[\]{}()#!|+\-.])/g, "\\$1");
}

export function recordMarkdown(record: SearchRecord): string {
  const sections = record.sections.map(
    (section) => `## ${section.title}\n\n${escapeMarkdown(section.text).replace(/\n/g, "  \n")}`,
  );
  return [
    `# ${escapeMarkdown(record.title.replace(/\s+/gu, " "))}`,
    `**提供館：${escapeMarkdown(record.library)}**  \n${DATA_TYPES[record.type]}`,
    ...sections,
    `[レファ協で元データを開く](${record.url})`,
    `---\n\n出典：[レファレンス協同データベース API 2.0](${HELP_URL})  \nデータの著作権は、特記のない限り提供館に帰属します。`,
  ].join("\n\n");
}
