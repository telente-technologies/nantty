"use client";

import { useEffect, useRef } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/media";
import { CheckmarkBadge } from "@/components/verification/checkmarkBadge";
import type { GetVerifiedCardState } from "@/utils/getVerifiedCardState.util";

import styles from "./feedModules.module.css";
import type { GetVerifiedFeedCardModel } from "./getVerifiedFeedCard.hook";

type VisibleState = Exclude<GetVerifiedCardState, { kind: "hidden" }>;

const checkmarkName = { blue: "Blue", gold: "Gold" } as const;

function copyFor(state: VisibleState) {
  const name = checkmarkName[state.color];
  if (state.kind === "pending") return { title: "Your verification is in review", body: `We'll let you know as soon as your ${name} checkmark is approved.`, action: "View status" };
  if (state.kind === "rejected") return { title: "Your verification wasn't approved", body: state.reason ? `Reason: ${state.reason}` : "See what to fix and try again.", action: "See what to fix" };
  const body = state.color === "blue" ? "Show people it's really you and stand out in comments, search and live." : "Show buyers your business is verified and build trust at checkout.";
  return { title: `Get the ${name} checkmark`, body, action: "Get verified" };
}

export function GetVerifiedCard({ model }: { readonly model: GetVerifiedFeedCardModel }) {
  const recorded = useRef(false);
  const { state, recordImpression } = model;
  useEffect(() => {
    if (recorded.current || state.kind === "hidden") return;
    recorded.current = true;
    recordImpression();
  }, [state.kind, recordImpression]);
  if (state.kind === "hidden") return null;
  const copy = copyFor(state);
  return (
    <section className={styles.verifiedCard} aria-label={copy.title}>
      <button type="button" className={[styles.iconButton, styles.verifiedClose].join(" ")} aria-label="Hide this suggestion for now" onClick={model.dismiss}>
        <AppIcon name="cancel20" size={18} />
      </button>
      <div className={styles.identity}>
        <Avatar name={model.viewerName} src={model.viewerAvatarUrl} size="lg" />
        <div className={styles.identityText}>
          <span className={styles.nameRow}>
            <span className={styles.name}>{model.viewerName}</span>
            <CheckmarkBadge color={state.color} label={`Preview of the ${checkmarkName[state.color]} checkmark`} />
          </span>
          <p className={styles.muted}>{state.kind === "offer" ? "Preview of your profile" : `${checkmarkName[state.color]} checkmark`}</p>
        </div>
      </div>
      <h2 className={styles.cardTitle}>{copy.title}</h2>
      <p className={styles.muted}>{copy.body}</p>
      {state.kind === "offer" && model.discountLine ? <p className={styles.discount}>{model.discountLine}</p> : null}
      <div className={styles.actions}>
        <Button onClick={model.openVerificationFlow}>{model.hasPersonalOffer ? "Use my offer" : copy.action}</Button>
        <Button variant="secondary" onClick={model.dismiss}>Not now</Button>
      </div>
      {state.kind === "offer" ? <button type="button" className={styles.neverAgain} onClick={model.neverShowAgain}>Don't show again</button> : null}
    </section>
  );
}
