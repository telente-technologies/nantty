import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { Cancel20Icon, Gif24Icon, PaperPlaneTilt24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { brandsService } from "@/services/sellers/brands.service";
import { useAuthStore } from "@/store/auth.store";
import type { ActingProfile } from "@/types/brand.type";
import { ComposerSlot } from "@/components/ui/composerSlot";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { MentionCountLabel, MentionSuggestionList } from "@/components/mentions/mentionSuggestionList";
import { useMentionComposer } from "@/components/mentions/mentionComposer.hook";
import type { Comment } from "@/types";
import { QuotedPostCard } from "@/components/feed/quotedPostCard";
import { useQuotedPostPreview } from "@/components/feed/quotedPostPreview.hook";
import type { CommentQuoteOptions } from "./commentThreadController.hook";
import type { MentionEntity } from "@/types/mention.type";
import { shiftMentionsAfterTrimmingStart } from "@/utils/mentions.util";
import { hasSendableContent } from "@/utils/sendableContent.util";

export const QUICK_REACTION_EMOJI = ["😂", "😍", "💕", "😊", "🥰", "😆", "😎", "🤔"] as const;

export interface CommentComposerProps {
  readonly myAvatarUrl: string | null;
  readonly onSubmit: (text: string, mentions: readonly MentionEntity[], quote?: CommentQuoteOptions, asProfile?: ActingProfile) => void;
  readonly placeholder?: string;
  readonly replyTarget?: Comment | null;
  readonly onCancelReply?: () => void;
  readonly avoidKeyboard?: boolean;
  readonly focusRequest?: number;
}

export const CommentComposer = forwardRef<TextInput, CommentComposerProps>(function CommentComposer(
  { myAvatarUrl, onSubmit, placeholder = "Add comment...", replyTarget, onCancelReply, avoidKeyboard = true, focusRequest = 0 },
  ref,
) {
  const { colors } = useTheme();
  const styles = useStyles();
  const authStatus = useAuthStore((state) => state.status);
  const profilesQuery = useQuery({ queryKey: ["users", "me", "profiles"], queryFn: brandsService.listMyProfiles, enabled: authStatus === "signedIn", staleTime: 60_000, retry: false });
  const commentProfiles = (profilesQuery.data ?? []).filter((profile: ActingProfile) => (profile.kind === "business" || profile.kind === "brand" || profile.kind === "store") && profile.onHold !== true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>();
  const selectedProfile = commentProfiles.find((profile) => profile.id === selectedProfileId);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<readonly MentionEntity[]>([]);
  const inputRef = useRef<TextInput>(null);
  const mentionComposer = useMentionComposer({
    surface: "comment",
    text,
    mentions,
    inputRef,
    signInReason: "comment",
    onChange: (nextText, nextMentions) => {
      setText(nextText);
      setMentions(nextMentions);
    },
  });
  const quote = useQuotedPostPreview(text);
  useImperativeHandle(ref, () => inputRef.current as TextInput);

  const lastFocusRequest = useRef(focusRequest);
  useEffect(() => {
    if (focusRequest === lastFocusRequest.current) return;
    lastFocusRequest.current = focusRequest;
    inputRef.current?.focus();
  }, [focusRequest]);

  const hasContent = hasSendableContent(text);
  const submitTypedComment = () => {
    if (!hasContent) return;
    const trimmed = shiftMentionsAfterTrimmingStart(text, mentions);
    onSubmit(trimmed.text, trimmed.mentions, { quotedPostId: quote.quotedPostId, quotedPost: quote.preview?.quoted ?? null }, selectedProfile);
    setText("");
    setMentions([]);
    quote.reset();
  };
  const effectivePlaceholder = replyTarget ? `Reply to @${replyTarget.author.username}...` : placeholder;

  return (
    <>
    {mentionComposer.suggestions ? <MentionSuggestionList suggestions={mentionComposer.suggestions} /> : null}
    <View style={styles.root}>
      {replyTarget ? (
        <View style={styles.replyingTo}>
          <Text size={12} lineHeight={16.8} color={colors.textMuted} numberOfLines={1} style={styles.flex}>
            Replying to{" "}
            <Text size={12} weight={600} lineHeight={16.8}>
              @{replyTarget.author.username}
            </Text>
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" hitSlop={10} onPress={onCancelReply}>
            <Cancel20Icon />
          </Pressable>
        </View>
      ) : null}
      {quote.preview ? (
        <QuotedPostCard compact quoted={quote.preview.quoted} loading={quote.preview.status === "loading"} unavailable={quote.preview.status === "unavailable"} onRemove={quote.remove} />
      ) : null}
      <View style={styles.emojiRow}>
        {QUICK_REACTION_EMOJI.map((emoji) => (
          <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Add ${emoji}`} onPress={() => mentionComposer.inputProps.onChangeText(text + emoji)}>
            <Text size={24} lineHeight={28.8} letterSpacing={-0.5}>
              {emoji}
            </Text>
          </Pressable>
        ))}
      </View>
      {commentProfiles.length > 0 ? (
        <View style={styles.identityPicker}>
          <Text size={11} weight={600} lineHeight={14} color={colors.textMuted}>Commenting as</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.identityOptions}>
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedProfile === undefined }} onPress={() => setSelectedProfileId(undefined)} style={[styles.identityOption, selectedProfile === undefined && styles.identityOptionActive]}>
              <Avatar uri={myAvatarUrl} size={22} placeholderColor={colors.placeholder} />
              <Text size={12} weight={500} lineHeight={16}>You</Text>
            </Pressable>
            {commentProfiles.map((profile) => (
              <Pressable key={profile.id} accessibilityRole="radio" accessibilityState={{ checked: profile.id === selectedProfile?.id }} onPress={() => setSelectedProfileId(profile.id)} style={[styles.identityOption, profile.id === selectedProfile?.id && styles.identityOptionActive]}>
                <Avatar uri={profile.avatarUrl} size={22} placeholderColor={colors.placeholder} />
                <Text size={12} weight={500} lineHeight={16} numberOfLines={1}>{profile.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.inputRow}>
        <Avatar uri={selectedProfile?.avatarUrl ?? myAvatarUrl} size={40} placeholderColor={colors.placeholder} />
        <View style={styles.field}>
          <TextInput
            ref={inputRef}
            {...mentionComposer.inputProps}
            placeholder={effectivePlaceholder}
            placeholderTextColor={colors.placeholder}
            selectionColor={colors.primary}
            returnKeyType="send"
            maxLength={1000}
            onSubmitEditing={submitTypedComment}
            accessibilityLabel={effectivePlaceholder}
            style={styles.input}
          />
          {hasContent ? (
            <ComposerSlot slotKey="send">
              <Pressable accessibilityRole="button" accessibilityLabel={replyTarget ? "Send reply" : "Send comment"} hitSlop={8} onPress={submitTypedComment}>
                <PaperPlaneTilt24Icon color={colors.primary} />
              </Pressable>
            </ComposerSlot>
          ) : (
            <ComposerSlot slotKey="gif">
              <View accessible accessibilityLabel="Add GIF">
                <Gif24Icon />
              </View>
            </ComposerSlot>
          )}
        </View>
      </View>
      <MentionCountLabel mentionCount={mentionComposer.mentionCount} />
    </View>
    {avoidKeyboard ? <KeyboardSpacer style={styles.keyboardArea} /> : null}
    </>
  );
});

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  root: { padding: 16, gap: 16, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  keyboardArea: { backgroundColor: colors.surface },
  replyingTo: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: -4 },
  emojiRow: { flexDirection: "row", justifyContent: "space-between" },
  identityPicker: { gap: 6 },
  identityOptions: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  identityOption: { minHeight: 34, maxWidth: 180, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, borderWidth: 1, borderColor: colors.divider, borderRadius: 18 },
  identityOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  field: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: "100%",
    padding: 0,
    fontFamily: fontFamily[400],
    fontSize: 14,
    letterSpacing: calculateDefaultLetterSpacing(14),
    color: colors.text,
  },
}));
