import * as WebBrowser from "expo-web-browser";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

const inlinePattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

export interface HelpLinkTarget {
  readonly categorySlug: string;
  readonly topicSlug: string | null;
}

export function readHelpLinkTarget(href: string): HelpLinkTarget | null {
  const match = /^\/help\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?\/?$/.exec(href);
  return match ? { categorySlug: match[1] ?? "", topicSlug: match[2] ?? null } : null;
}

function InlineText({ text, onOpenHelpLink }: { readonly text: string; readonly onOpenHelpLink: (target: HelpLinkTarget) => void }) {
  const { colors } = useTheme();
  const pieces = text.split(inlinePattern).map((piece, index): ReactNode => {
    if (piece.startsWith("**") && piece.endsWith("**")) return <Text key={index} size={14} weight={600} lineHeight={21}>{piece.slice(2, -2)}</Text>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(piece);
    if (link) {
      const href = link[2] ?? "";
      const target = readHelpLinkTarget(href);
      const open = () => (target ? onOpenHelpLink(target) : href.startsWith("https://") ? void WebBrowser.openBrowserAsync(href) : undefined);
      return <Text key={index} size={14} lineHeight={21} color={colors.primary} underline accessibilityRole="link" onPress={open}>{link[1]}</Text>;
    }
    if (piece.startsWith("*") && piece.endsWith("*") && piece.length > 2) return <Text key={index} size={14} lineHeight={21} style={{ fontStyle: "italic" }}>{piece.slice(1, -1)}</Text>;
    return piece;
  });
  return <Text size={14} lineHeight={21}>{pieces}</Text>;
}

export function HelpMarkdown({ markdown, onOpenHelpLink }: { readonly markdown: string; readonly onOpenHelpLink: (target: HelpLinkTarget) => void }) {
  const styles = useStyles();
  const blocks: ReactNode[] = [];
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (line === "") continue;
    const key = `block-${index}`;
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? "").trim().startsWith("|")) {
        const row = (lines[index] ?? "").trim();
        if (!/^\|\s*-/.test(row)) rows.push(row.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
        index += 1;
      }
      index -= 1;
      blocks.push(
        <View key={key} style={styles.table} accessibilityRole="summary">
          {rows.map((cells, rowIndex) => (
            <View key={rowIndex} style={[styles.tableRow, rowIndex === 0 && styles.tableHeader]}>
              {cells.map((cell, cellIndex) => <View key={cellIndex} style={styles.tableCell}><InlineText text={cell} onOpenHelpLink={onOpenHelpLink} /></View>)}
            </View>
          ))}
        </View>,
      );
    } else if (/^([-*]|\d+\.) /.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items: string[] = [];
      while (index < lines.length && /^([-*]|\d+\.) /.test((lines[index] ?? "").trim())) items.push((lines[index++] ?? "").trim().replace(/^([-*]|\d+\.) /, ""));
      index -= 1;
      blocks.push(
        <View key={key} style={styles.list}>
          {items.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.listItem}>
              <Text size={14} lineHeight={21}>{ordered ? `${itemIndex + 1}.` : "•"}</Text>
              <View style={styles.flex}><InlineText text={item} onOpenHelpLink={onOpenHelpLink} /></View>
            </View>
          ))}
        </View>,
      );
    } else if (/^#{1,3} /.test(line)) {
      blocks.push(<Text key={key} size={line.startsWith("# ") ? 18 : 16} weight={600} lineHeight={22} accessibilityRole="header">{line.replace(/^#{1,3} /, "")}</Text>);
    } else {
      blocks.push(<InlineText key={key} text={line} onOpenHelpLink={onOpenHelpLink} />);
    }
  }
  return <View style={styles.body}>{blocks}</View>;
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { gap: 12 },
  flex: { flex: 1 },
  list: { gap: 6 },
  listItem: { flexDirection: "row", gap: 8 },
  table: { borderWidth: 1, borderColor: colors.divider, borderRadius: 8, overflow: "hidden" },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.divider },
  tableHeader: { backgroundColor: colors.surface, borderTopWidth: 0 },
  tableCell: { flex: 1, padding: 8 },
}));
