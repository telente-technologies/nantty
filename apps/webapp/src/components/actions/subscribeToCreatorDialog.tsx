"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { StarIcon } from "@/components/ui/icons";
import { ModalDialog } from "@/components/ui/modalDialog";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { creatorSubscriptionsService } from "@/services/webActions.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { openHostedCheckout } from "@/utils/hostedCheckout.util";

import styles from "./actionDialogs.module.css";

interface SubscribeToCreatorDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly creatorId: string;
  readonly creatorName: string;
}

export function SubscribeToCreatorDialog({ isOpen, onClose, creatorId, creatorName }: SubscribeToCreatorDialogProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const plansQuery = useQuery({ queryKey: ["creatorPlans", creatorId], queryFn: () => creatorSubscriptionsService.fetchPlans(creatorId), enabled: isOpen, retry: false });
  const subscribeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const checkout = await creatorSubscriptionsService.startSubscription(creatorId, planId);
      if (openHostedCheckout(checkout) === "blocked") throw new Error("Unexpected payment page.");
      return checkout;
    },
  });
  const plans = plansQuery.data ?? [];

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Subscribe to ${creatorName}`}
      description="Support this creator and unlock subscriber-only posts, clips and lives. Pay by card, bank transfer or USSD in a secure window."
      tone="brand"
      icon={<StarIcon size={24} />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => selectedPlanId && subscribeMutation.mutate(selectedPlanId)} disabled={!selectedPlanId} busy={subscribeMutation.isPending}>
            Continue to checkout
          </Button>
        </>
      }
    >
      {plansQuery.isLoading ? (
        <div className={styles.optionList}>
          {[0, 1].map((index) => (
            <Skeleton key={index} height={72} />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState title="No plans yet" description={`${creatorName} hasn't opened subscriptions.`} />
      ) : (
        <fieldset className={styles.optionList}>
          <legend className="visuallyHidden">Plans</legend>
          {plans.map((plan) => (
            <label key={plan.id} className={styles.option}>
              <input type="radio" name="subscription-plan" checked={selectedPlanId === plan.id} onChange={() => setSelectedPlanId(plan.id)} />
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>{plan.name}</span>
                <span className={styles.optionMeta}>{plan.benefits.slice(0, 3).join(" · ")}</span>
              </span>
              <strong>
                {formatMoneyForDisplay(plan.price)}/{plan.interval === "month" ? "mo" : "yr"}
              </strong>
            </label>
          ))}
        </fieldset>
      )}
      <p className={styles.muted}>Renews automatically. Cancel any time from your account.</p>
      {subscribeMutation.isError ? (
        <p className={styles.error} role="alert">
          {readErrorMessageForDisplay(subscribeMutation.error)}
        </p>
      ) : null}
    </ModalDialog>
  );
}
