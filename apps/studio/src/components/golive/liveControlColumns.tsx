"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { livesService } from "@/services/lives.service";
import type { ID } from "@/types";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";

import styles from "./liveControl.module.css";

function PinnedProductsCard({ liveId }: { readonly liveId: ID }) {
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ["live-products", liveId], queryFn: () => livesService.listPinnedProducts(liveId) });
  const catalogue = useQuery({ queryKey: ["live-catalogue"], queryFn: () => livesService.listPinneableProducts() });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["live-products", liveId] });
  const pinProduct = useMutation({ mutationFn: (productId: string) => livesService.pinProduct(liveId, productId), onSuccess: refresh });
  const unpinProduct = useMutation({ mutationFn: () => livesService.unpinProduct(liveId), onSuccess: refresh });
  const failure = pinProduct.error ?? unpinProduct.error;

  return (
    <section className={styles.card} aria-labelledby={`pins-${liveId}`}>
      <h2 className={styles.cardTitle} id={`pins-${liveId}`}>Pinned products</h2>
      <ul className={styles.list}>
        {products.data?.map((product) => (
          <li key={product.id} className={styles.listItem}>
            <span className={styles.listItemMain}>{product.title}</span>
            <span className={styles.listItemMeta}>{formatMoneyForDisplay(product.price)}{product.pinned ? " · On screen" : ""}</span>
            {product.pinned ? (
              <button type="button" className={styles.chip} disabled={unpinProduct.isPending} onClick={() => unpinProduct.mutate()}>Unpin</button>
            ) : null}
          </li>
        ))}
      </ul>
      {products.isError ? <ErrorState title="Pinned products didn't load" description={readLiveErrorMessage(products.error)} onRetry={() => void products.refetch()} /> : null}
      {products.isSuccess && products.data.length === 0 ? <p className={styles.muted}>Nothing pinned yet. Pick a product below to show it on stream.</p> : null}
      {failure ? <p className={styles.error} role="alert">{readLiveErrorMessage(failure)}</p> : null}
      <div className={styles.chipRow}>
        {catalogue.data
          ?.filter((product) => !products.data?.some((pinned) => pinned.id === product.id))
          .map((product) => (
            <button key={product.id} type="button" className={styles.chip} disabled={pinProduct.isPending} onClick={() => pinProduct.mutate(product.id)}>
              + {product.title}
            </button>
          ))}
      </div>
    </section>
  );
}

function LiveChatCard({ liveId, ended }: { readonly liveId: ID; readonly ended: boolean }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const comments = useQuery({ queryKey: ["live-comments", liveId], queryFn: () => livesService.listComments(liveId), refetchInterval: ended ? false : 5000 });
  const postComment = useMutation({
    mutationFn: () => livesService.postComment(liveId, draft.trim()),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["live-comments", liveId] });
    },
  });

  return (
    <section className={styles.card} aria-labelledby={`chat-${liveId}`}>
      <h2 className={styles.cardTitle} id={`chat-${liveId}`}>Live chat</h2>
      <ul className={styles.list} aria-live="polite" aria-relevant="additions">
        {comments.data?.map((comment) => (
          <li key={comment.id} className={styles.listItem}>
            <span className={styles.listItemMain}><strong>{comment.authorName}</strong> {comment.text}</span>
            <span className={styles.listItemMeta}>{formatTimeSincePosted(comment.createdAt)}</span>
          </li>
        ))}
      </ul>
      {comments.isError ? <ErrorState title="Chat didn't load" error={comments.error} onRetry={() => void comments.refetch()} /> : null}
      {comments.isSuccess && comments.data.length === 0 ? <p className={styles.muted}>No comments yet. They appear here as viewers chat.</p> : null}
      {postComment.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(postComment.error)}</p> : null}
      {ended ? null : (
        <form
          className={styles.commentForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim() && !postComment.isPending) postComment.mutate();
          }}
        >
          <input className={styles.commentInput} aria-label="Comment" maxLength={300} placeholder="Say something to your viewers" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <Button type="submit" busy={postComment.isPending} disabled={!draft.trim()}>Send</Button>
        </form>
      )}
    </section>
  );
}

export function LiveControlColumns({ liveId, canPinProducts, ended }: { readonly liveId: ID; readonly canPinProducts: boolean; readonly ended: boolean }) {
  return (
    <div className={styles.columns}>
      {canPinProducts && !ended ? <PinnedProductsCard liveId={liveId} /> : null}
      <LiveChatCard liveId={liveId} ended={ended} />
    </div>
  );
}
