"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { creatorProgramService } from "@/services/creatorProgram.service";
import { walletsService } from "@/services/wallets.service";
import type { CreatorContentCategory } from "@/types/creator.type";

import styles from "../program/page.module.css";

const CATEGORIES: readonly CreatorContentCategory[] = ["fashion", "beauty", "tech", "food", "lifestyle", "comedy", "music", "education", "fitness", "parenting"];

export default function CreatorApplyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: ["wallet", "payout-accounts"], queryFn: () => walletsService.listMyPayoutAccounts() });
  const [categories, setCategories] = useState<readonly CreatorContentCategory[]>([]);
  const [socialLink, setSocialLink] = useState("");
  const [sampleUrl, setSampleUrl] = useState("");
  const [payoutAccountId, setPayoutAccountId] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () => {
      if (categories.length === 0) throw new Error("Pick at least one content category.");
      if (!payoutAccountId) throw new Error("Pick a payout account.");
      if (!acceptedTerms) throw new Error("Accept the creator terms to continue.");
      return creatorProgramService.submitCreatorApplication({
        contentCategories: categories,
        socialLinks: socialLink.trim() ? [{ platform: "other", url: socialLink.trim() }] : [],
        sampleContentUrls: sampleUrl.trim() ? [sampleUrl.trim()] : [],
        payoutAccountId,
        acceptedCreatorTermsVersion: "v1",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["creator"] });
      showToast({ text: "Application submitted" });
      router.push("/creator/program");
    },
    onError: (mutationError) => setError(readErrorMessageForDisplay(mutationError)),
  });
  function toggleCategory(category: CreatorContentCategory) {
    setCategories((current) => (current.includes(category) ? current.filter((entry) => entry !== category) : [...current, category]));
  }
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Apply to the creator program</h1>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
      >
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Content categories</h2>
          <div className={styles.chips}>
            {CATEGORIES.map((category) => (
              <button key={category} type="button" className={[styles.chip, categories.includes(category) ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={categories.includes(category)} onClick={() => toggleCategory(category)}>{category}</button>
            ))}
          </div>
        </div>
        <label className={styles.field}>Social profile URL
          <input className={styles.input} value={socialLink} onChange={(event) => setSocialLink(event.target.value)} placeholder="https://" inputMode="url" />
        </label>
        <label className={styles.field}>Sample content URL
          <input className={styles.input} value={sampleUrl} onChange={(event) => setSampleUrl(event.target.value)} placeholder="https://" inputMode="url" />
        </label>
        <label className={styles.field}>Payout account
          <select className={styles.select} value={payoutAccountId} onChange={(event) => setPayoutAccountId(event.target.value)} required>
            <option value="">Select account</option>
            {(accounts.data ?? []).map((account) => (
              <option key={account.id} value={account.id}>{account.bankName} · {account.accountNumberMasked}</option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
          I accept the creator terms (v1)
        </label>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button type="submit" className={styles.primary} disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit application"}</button>
      </form>
    </div>
  );
}
