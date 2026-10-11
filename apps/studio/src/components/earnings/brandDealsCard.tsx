"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, DataRows, Muted, pageStyles } from "@/components/ui/studioPage";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { creatorService } from "@/services/creator.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const emptyDraft = { brandName: "", amount: "", startsOn: "", endsOn: "", disclosure: "", notes: "" };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function BrandDealsCard({ currency }: { readonly currency: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const deals = useQuery({ queryKey: ["creator", "brand-deals"], queryFn: creatorService.listBrandDeals });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["creator", "brand-deals"] });
  const record = useMutation({
    mutationFn: () =>
      creatorService.recordBrandDeal({
        brandName: draft.brandName.trim(),
        amountMinor: Math.round(Number(draft.amount || "0") * 100),
        currency,
        startsAt: new Date(`${draft.startsOn}T00:00:00Z`).toISOString(),
        endsAt: draft.endsOn ? new Date(`${draft.endsOn}T23:59:59Z`).toISOString() : null,
        disclosure: draft.disclosure.trim() || `Paid partnership with ${draft.brandName.trim()}`,
        notes: draft.notes.trim(),
      }),
    onSuccess: () => {
      setDraft(emptyDraft);
      void refresh();
    },
    onError: (error) => setFormError(readErrorMessageForDisplay(error)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (record.isPending) return;
    if (!draft.brandName.trim() || !draft.startsOn) return setFormError("Add the brand name and the start date.");
    if (!/^\d+(\.\d{1,2})?$/.test(draft.amount || "0")) return setFormError("Enter the fee as a number, for example 250000.");
    if (draft.endsOn && draft.endsOn < draft.startsOn) return setFormError("The end date must be after the start date.");
    record.mutate();
  }

  async function remove(dealId: string, brandName: string) {
    await requestConfirmation({
      title: `Remove the ${brandName} deal?`,
      description: "This only removes your record. It doesn't change anything you already posted.",
      confirmLabel: "Remove",
      intent: "remove",
      onConfirm: async () => {
        await creatorService.removeBrandDeal(dealId);
        await refresh();
      },
      describeError: readErrorMessageForDisplay,
    });
  }

  return (
    <Card title="Brand deals">
      <Muted>Record paid partnerships so your posts carry the right disclosure. Brands pay you directly; Zudomart doesn't take a cut.</Muted>
      {deals.isError ? <ErrorState title="Brand deals didn't load" error={deals.error} onRetry={() => void deals.refetch()} /> : null}
      {deals.isLoading ? <Skeleton height={60} /> : null}
      {deals.data && deals.data.data.length === 0 ? <EmptyState title="No brand deals recorded" description="Add one below when a brand pays you to feature them." /> : null}
      <DataRows
        rows={(deals.data?.data ?? []).map((deal) => ({
          key: deal.id,
          label: deal.brandName,
          detail: `${shortDate(deal.startsAt)}${deal.endsAt ? ` to ${shortDate(deal.endsAt)}` : ""} · "${deal.disclosure}"`,
          value: (
            <span className={pageStyles.inlineActions}>
              {formatMoneyForDisplay(deal.amount)}
              <Button size="sm" variant="ghost" onClick={() => void remove(deal.id, deal.brandName)}>Remove</Button>
            </span>
          ),
        }))}
      />
      <form className={pageStyles.form} onSubmit={submit}>
        <TextField label="Brand" value={draft.brandName} maxLength={120} onChange={(event) => setDraft({ ...draft, brandName: event.target.value })} />
        <TextField label={`Fee (${currency})`} inputMode="decimal" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
        <TextField label="Starts" type="date" value={draft.startsOn} onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })} />
        <TextField label="Ends (optional)" type="date" value={draft.endsOn} onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })} />
        <TextField label="Disclosure shown on posts" placeholder={`Paid partnership with ${draft.brandName || "brand"}`} maxLength={500} value={draft.disclosure} onChange={(event) => setDraft({ ...draft, disclosure: event.target.value })} />
        <Button type="submit" busy={record.isPending}>Record deal</Button>
      </form>
      {formError ? <p className={pageStyles.error} role="alert">{formError}</p> : null}
    </Card>
  );
}
