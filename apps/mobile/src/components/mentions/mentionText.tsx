import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { Text, type TextProps } from "@/components/ui/text";
import { useOpenUserByUsername } from "@/hooks/useOpenUserByUsername.hook";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import { showToast } from "@/store/toast.store";
import type { MentionEntity, MentionTargetsByUserId } from "@/types/mention.type";
import { containsLink, splitTextByUrls } from "@/utils/linkify.util";
import { isAllMention } from "@/utils/mentions.util";
import { splitTextByTags } from "@/utils/usernameTags.util";
import { inAppBrowserColorsFromTheme, openLinkFromText } from "@/components/links/openLink.util";

import { useMentionTargets } from "./mentionTargets.hook";

export interface MentionTextProps extends Omit<TextProps, "children"> {
  readonly text: string;
  readonly mentions?: readonly MentionEntity[];
  readonly mentionColor?: string;
}

const USER_NOT_FOUND_MESSAGE = "User not found";
const NON_BREAKING_SPACE = " ";

const describeSegment = (segmentText: string, mention: MentionEntity, targets: MentionTargetsByUserId | undefined) => {
  if (isAllMention(mention)) return { kind: "everyone" as const, label: `${NON_BREAKING_SPACE}${segmentText}${NON_BREAKING_SPACE}` };
  const target = targets?.[mention.userId];
  if (target?.status === "suspended") return { kind: "plain" as const, label: segmentText };
  return { kind: "user" as const, label: target?.username ? `@${target.username}` : segmentText };
};

export function MentionText({ text, mentions, mentionColor, ...textProps }: MentionTextProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const openUserProfile = useOpenUserProfile();
  const openUserByUsername = useOpenUserByUsername();
  const targets = useMentionTargets(mentions);
  const segments = useMemo(() => splitTextByTags(text, mentions), [text, mentions]);
  if (!text.includes("@") && !containsLink(text)) return <Text {...textProps}>{text}</Text>;
  const highlightColor = mentionColor ?? colors.primary;
  const linkColor = mentionColor ?? colors.link;
  const browserColors = inAppBrowserColorsFromTheme(colors);

  const renderPlainText = (plain: string, keyPrefix: string) =>
    splitTextByUrls(plain).map((piece, pieceIndex) => {
      const href = piece.href;
      if (!href) return piece.text;
      return (
        <Text
          key={`${keyPrefix}_url_${pieceIndex}`}
          {...textProps}
          color={linkColor}
          underline={mentionColor !== undefined}
          accessibilityRole="link"
          accessibilityHint="Opens the link"
          onPress={() => openLinkFromText(href, browserColors)}
        >
          {piece.text}
        </Text>
      );
    });

  const openMention = (mention: MentionEntity) => {
    if (isAllMention(mention)) return;
    if (targets?.[mention.userId]?.status === "deleted") showToast(USER_NOT_FOUND_MESSAGE);
    else openUserProfile(mention.userId);
  };

  return (
    <Text {...textProps}>
      {segments.map((segment, index) => {
        if (segment.username) {
          const username = segment.username;
          return (
            <Text key={`tag_${index}`} {...textProps} weight={600} color={highlightColor} accessibilityRole="link" onPress={() => void openUserByUsername(username)}>
              {segment.text}
            </Text>
          );
        }
        if (!segment.entity) return renderPlainText(segment.text, `plain_${index}`);
        const description = describeSegment(segment.text, segment.entity, targets);
        if (description.kind === "plain") return segment.text;
        const mention = segment.entity;
        return (
          <Text
            key={`${mention.start}_${index}`}
            {...textProps}
            weight={600}
            color={highlightColor}
            underline={mentionColor !== undefined}
            style={description.kind === "everyone" ? styles.everyonePill : undefined}
            accessibilityRole={description.kind === "everyone" ? "text" : "link"}
            onPress={description.kind === "everyone" ? undefined : () => openMention(mention)}
          >
            {description.label}
          </Text>
        );
      })}
    </Text>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  everyonePill: { backgroundColor: colors.primaryTint },
}));
