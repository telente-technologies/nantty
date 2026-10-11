"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ClipboardEvent, type DragEvent } from "react";

import { QuotedPostCard } from "@/components/feed/quotedPostCard";
import { QUOTE_UNAVAILABLE_MESSAGE, useQuotedPostPreview } from "@/components/feed/quotedPostPreview.hook";
import { MentionAutocompleteInput } from "@/components/mentions/mentionAutocompleteInput";
import mentionStyles from "@/components/mentions/mentions.module.css";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { ImageIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { useIsOnline } from "@/components/ui/onlineStatus.hook";
import { createIdempotencyKey, readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { composerService } from "@/services/composer.service";
import { contentPreferencesService } from "@/services/contentPreferences.service";
import { maximumMentionsPerText } from "@/types/mentions.type";
import {
  canPublishComposerDraft, clearSavedComposerDraft, describePublishButton, EMPTY_COMPOSER_DRAFT, FREE_POST_TEXT_LIMIT, PREMIUM_POST_TEXT_LIMIT, readSavedComposerDraft, saveComposerDraft, type ComposerDraft,
} from "@/utils/composerDraft.util";
import { ALLOWED_IMAGE_MIME_TYPES, ALLOWED_VIDEO_MIME_TYPES } from "@/utils/mediaUploadRules.util";
import { buildMentionEntitiesFromText, countMentionsInText } from "@/utils/mentions.util";

import { ComposerMediaGrid } from "./composerMediaGrid";
import { useComposerMediaUploads } from "./composerMediaUploads.hook";
import { ComposerSettings } from "./composerSettings";
import styles from "./composer.module.css";

const browserStorage = () => (typeof window === "undefined" ? undefined : window.localStorage);
const acceptedMediaTypes = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES].join(",");

export function PostComposer({ quotePostId = null }: { readonly quotePostId?: string | null } = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { viewer } = useSession();
  const viewerId = viewer?.id ?? "";
  const textId = useId();
  const counterId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isOnline = useIsOnline();
  const [draft, setDraft] = useState<ComposerDraft>(EMPTY_COMPOSER_DRAFT);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState<readonly string[]>([]);
  const publishKey = useRef<string | null>(null);
  const publishInFlight = useRef(false);
  const uploads = useComposerMediaUploads("post");
  const quote = useQuotedPostPreview(draft.text, quotePostId);
  const creatorStatus = useQuery({ queryKey: ["creator", "status", viewerId], queryFn: composerService.fetchMyCreatorStatus, enabled: viewerId !== "", retry: false });
  const preferences = useQuery({ queryKey: ["contentPreferences"], queryFn: contentPreferencesService.fetchContentPreferences, enabled: viewerId !== "", retry: false });
  const textLimit = viewer?.isPremium ? PREMIUM_POST_TEXT_LIMIT : FREE_POST_TEXT_LIMIT;
  const mentionCount = countMentionsInText(draft.text, draft.mentions);

  useEffect(() => {
    if (!viewerId || isDraftLoaded) return;
    const saved = readSavedComposerDraft(browserStorage(), viewerId, quotePostId);
    if (saved) {
      setDraft(saved);
      setHasRestoredDraft(true);
      if (!quotePostId && saved.quotedPostId) quote.attach(saved.quotedPostId);
    }
    setIsDraftLoaded(true);
  }, [viewerId, isDraftLoaded, quotePostId, quote]);

  useEffect(() => {
    if (isDraftLoaded && viewerId) saveComposerDraft(browserStorage(), viewerId, { ...draft, quotedPostId: quote.attachedPostId }, quotePostId);
  }, [draft, isDraftLoaded, viewerId, quote.attachedPostId, quotePostId]);

  const updateDraft = (next: ComposerDraft) => {
    publishKey.current = null;
    setDraft(next);
  };

  const publish = useMutation({
    mutationFn: async () => {
      const mediaIds = await uploads.waitForAllMediaIds();
      const text = draft.text.trim();
      publishKey.current ??= createIdempotencyKey("post");
      return composerService.publishPost({
        text,
        mediaIds,
        audience: draft.audience,
        kind: "post",
        mentions: buildMentionEntitiesFromText(text, draft.mentions),
        replyPolicy: draft.replyPolicy,
        visibility: draft.visibility,
        ...(draft.isAiGenerated ? { isAiGenerated: true } : {}),
        ...(draft.sensitiveLabels.length > 0 ? { sensitiveLabels: draft.sensitiveLabels } : {}),
        ...(draft.tagged.length > 0 ? { taggedUserIds: draft.tagged.map((person) => person.id) } : {}),
        ...(draft.products.length > 0 ? { productIds: draft.products.map((product) => product.id) } : {}),
        ...(draft.location ? { location: draft.location } : {}),
        ...(quote.quotedPostId === undefined ? {} : { quotedPostId: quote.quotedPostId }),
      }, publishKey.current);
    },
    onError: (error) => {
      if (error instanceof WebappRequestError && error.code === "QUOTED_POST_UNAVAILABLE") quote.refresh();
    },
    onSuccess: (post) => {
      clearSavedComposerDraft(browserStorage(), viewerId, quotePostId);
      publishKey.current = null;
      queryClient.setQueryData(["post", post.id], post);
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      setDraft(EMPTY_COMPOSER_DRAFT);
      uploads.clearAll();
      showToast({ text: "Your post is live" });
      router.replace(`/post/${encodeURIComponent(post.id)}`);
    },
  });

  const isBusy = publish.isPending;
  const canPublish = canPublishComposerDraft(draft, uploads.items.length, textLimit) && !uploads.hasFailedUploads && isOnline && !quote.isUnavailable;
  const hasUnsavedWork = uploads.items.length > 0 || publish.isPending;

  useEffect(() => {
    if (!hasUnsavedWork) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedWork]);

  const submit = () => {
    if (!canPublish || publishInFlight.current) return;
    publishInFlight.current = true;
    publish.mutate(undefined, { onSettled: () => { publishInFlight.current = false; } });
  };

  const addFiles = async (files: readonly File[]) => {
    if (files.length === 0) return;
    setRejectedFiles(await uploads.addFiles(files));
  };
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!isBusy) void addFiles([...event.dataTransfer.files]);
  };
  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    const files = [...event.clipboardData.files];
    if (files.length === 0 || isBusy) return;
    event.preventDefault();
    void addFiles(files);
  };

  const discardDraft = () => {
    clearSavedComposerDraft(browserStorage(), viewerId, quotePostId);
    setDraft(EMPTY_COMPOSER_DRAFT);
    setHasRestoredDraft(false);
    quote.reset();
    if (quotePostId) quote.attach(quotePostId);
  };

  return (
    <form
      className={styles.composer}
      aria-labelledby="composer-title"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <header className={styles.header}>
        <h1 id="composer-title" className={styles.title}>{quote.preview ? "Quote" : "Post"}</h1>
        <Button type="submit" busy={isBusy} disabled={!canPublish}>{describePublishButton(isBusy, uploads.combinedUploadedFraction)}</Button>
      </header>
      {hasRestoredDraft ? (
        <p className={styles.draftNotice} role="status">
          We kept your unsent draft.
          <button type="button" className={styles.textButton} onClick={discardDraft}>Discard draft</button>
        </p>
      ) : null}
      {isOnline ? null : <p className={styles.offlineNotice} role="status">You&apos;re offline. Your draft is saved and uploads resume when you&apos;re back online.</p>}
      <MentionAutocompleteInput
        id={textId}
        multiline
        rows={5}
        value={draft.text}
        onChange={(text) => updateDraft({ ...draft, text })}
        chosenMentions={draft.mentions}
        onChooseMention={(mention) => updateDraft({ ...draft, mentions: draft.mentions.some((entry) => entry.userId === mention.userId) ? draft.mentions : [...draft.mentions, mention] })}
        placeholder="What’s happening?"
        ariaLabel="What’s happening?"
        ariaDescribedBy={counterId}
        className={styles.textInput}
        maxLength={textLimit}
        enabled={!isBusy}
        surface="post"
        autoFocus
      />
      <div className={styles.meta} id={counterId}>
        <span className={styles.hint}>Type @ to mention someone or # to add a hashtag</span>
        {mentionCount > 0 ? <span className={mentionStyles.mentionCounter}>{mentionCount}/{maximumMentionsPerText} mentions</span> : null}
        <span className={draft.text.length > textLimit ? styles.countOver : draft.text.length >= textLimit * 0.9 ? styles.countNear : styles.count}>{draft.text.length}/{textLimit}</span>
      </div>
      {quote.preview ? <QuotedPostCard quoted={quote.preview.quoted} loading={quote.preview.status === "loading"} unavailable={quote.preview.status === "unavailable"} onRemove={quote.remove} /> : null}
      {quote.isUnavailable ? <p className={styles.fieldError} role="alert">{QUOTE_UNAVAILABLE_MESSAGE}</p> : null}
      <ComposerMediaGrid items={uploads.items} disabled={isBusy} onRemove={uploads.removeItem} onRetry={uploads.retryItem} onMove={uploads.moveItem} />
      {rejectedFiles.length > 0 ? (
        <div className={styles.fieldError} role="alert">
          <strong>Some files weren&apos;t added</strong>
          {rejectedFiles.map((message) => <p key={message}>{message}</p>)}
        </div>
      ) : null}
      <div className={styles.toolbar}>
        <input ref={fileInputRef} type="file" accept={acceptedMediaTypes} multiple hidden onChange={(event) => { void addFiles([...(event.target.files ?? [])]); event.target.value = ""; }} />
        <button type="button" className={styles.toolButton} aria-label="Add photos or videos" disabled={isBusy || uploads.remainingSlots <= 0} onClick={() => fileInputRef.current?.click()}>
          <ImageIcon size={20} />
          <span>Photos or videos</span>
        </button>
        <button type="button" className={styles.audienceButton} aria-label={`Who can see this post: ${draft.audience === "everyone" ? "Everyone" : "Followers"}`} disabled={isBusy} onClick={() => updateDraft({ ...draft, audience: draft.audience === "everyone" ? "followers" : "everyone" })}>
          {draft.audience === "everyone" ? "Everyone" : "Followers"}
        </button>
      </div>
      <ComposerSettings draft={draft} onChange={updateDraft} isApprovedCreator={creatorStatus.data?.status === "approved"} isAdult={preferences.data?.ageBracket === "adult"} />
      {publish.isError ? <p className={styles.fieldError} role="alert">{publish.error instanceof Error && !("status" in publish.error) ? publish.error.message : readErrorMessageForDisplay(publish.error)}</p> : null}
    </form>
  );
}
