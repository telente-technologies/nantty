import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createElement, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Text as NativeText, type NativeSyntheticEvent, type TextInput, type TextInputSelectionChangeEventData } from "react-native";

import { useTheme } from "@/theme";

import { mentionsService } from "@/services/content/mentions.service";
import { useAuthStore } from "@/store/auth.store";
import { showToast } from "@/store/toast.store";
import type { MentionCandidate, MentionEntity, MentionEveryoneOption, MentionSurface } from "@/types/mention.type";
import {
  MAXIMUM_MENTIONS_PER_CONTENT,
  findActiveMentionQuery,
  insertMentionToken,
  keepEntitiesMatchingEditedText,
  splitTextByMentions,
  type ActiveMentionQuery,
} from "@/utils/mentions.util";
import { requireAuthThen } from "@/utils/requireAuth.util";

const MENTION_SEARCH_DEBOUNCE_MS = 150;
const LIMIT_REACHED_MESSAGE = `You can mention up to ${MAXIMUM_MENTIONS_PER_CONTENT} people`;

export interface UseMentionComposerOptions {
  readonly surface: MentionSurface;
  readonly conversationId?: string;
  readonly text: string;
  readonly mentions: readonly MentionEntity[];
  readonly onChange: (text: string, mentions: readonly MentionEntity[]) => void;
  readonly inputRef: RefObject<TextInput | null>;
  readonly signInReason: string;
  readonly isEnabled?: boolean;
}

export interface MentionSuggestionsState {
  readonly candidates: readonly MentionCandidate[];
  readonly everyone: MentionEveryoneOption | null;
  readonly isLoading: boolean;
  readonly mentionCount: number;
  readonly onPickCandidate: (candidate: MentionCandidate) => void;
  readonly onPickEveryone: () => void;
}

const useDebouncedValue = <T,>(value: T, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

export function useMentionComposer({ surface, conversationId, text, mentions, onChange, inputRef, signInReason, isEnabled = true }: UseMentionComposerOptions) {
  const { colors } = useTheme();
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [forcedCaret, setForcedCaret] = useState<number | null>(null);
  const activeQuery: ActiveMentionQuery | null = isSignedIn && isEnabled ? findActiveMentionQuery(text, selectionEnd) : null;
  const typedQuery = activeQuery?.query ?? null;
  const laggedQuery = useDebouncedValue(typedQuery, MENTION_SEARCH_DEBOUNCE_MS);
  const debouncedQuery = typedQuery === "" ? "" : laggedQuery;
  const lastActiveQueryRef = useRef(activeQuery);
  lastActiveQueryRef.current = activeQuery;

  const search = useQuery({
    queryKey: ["mention-candidates", surface, conversationId ?? null, debouncedQuery],
    queryFn: () => mentionsService.searchMentionCandidates(surface, debouncedQuery ?? "", conversationId),
    enabled: activeQuery !== null && debouncedQuery !== null,
    placeholderData: keepPreviousData,
  });

  const applyInsertion = (label: string, entityWithoutPosition: Parameters<typeof insertMentionToken>[4]["entityWithoutPosition"]) => {
    const query = lastActiveQueryRef.current;
    if (!query) return;
    if (mentions.length >= MAXIMUM_MENTIONS_PER_CONTENT) {
      showToast(LIMIT_REACHED_MESSAGE);
      return;
    }
    const result = insertMentionToken(text, mentions, query, selectionEnd, { label, entityWithoutPosition });
    onChange(result.text, result.mentions);
    setForcedCaret(result.caretPosition);
    setSelectionEnd(result.caretPosition);
  };

  const suggestions: MentionSuggestionsState | null = activeQuery
    ? {
        candidates: search.data?.candidates ?? [],
        everyone: search.data?.everyone ?? null,
        isLoading: search.isFetching,
        mentionCount: mentions.length,
        onPickCandidate: (candidate) => {
          if (candidate.allowsMentions) applyInsertion(candidate.user.username, { userId: candidate.user.id, username: candidate.user.username });
        },
        onPickEveryone: () => applyInsertion("all", { type: "all" }),
      }
    : null;

  const highlightedChildren: ReactNode[] | undefined = mentions.length
    ? splitTextByMentions(text, mentions).map((segment, index) =>
        segment.mention ? createElement(NativeText, { key: index, style: { color: colors.primary } }, segment.text) : segment.text,
      )
    : undefined;

  const inputProps = {
    ...(highlightedChildren ? { children: highlightedChildren } : { value: text }),
    onChangeText: (nextText: string) => onChange(nextText, keepEntitiesMatchingEditedText(text, nextText, mentions)),
    onSelectionChange: (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      setSelectionEnd(event.nativeEvent.selection.end);
      setForcedCaret(null);
    },
    selection: forcedCaret === null ? undefined : { start: forcedCaret, end: forcedCaret },
    onFocus: () => {
      if (isSignedIn) return;
      inputRef.current?.blur();
      requireAuthThen(() => inputRef.current?.focus(), null, signInReason);
    },
  };

  return { inputProps, suggestions, mentionCount: mentions.length };
}
