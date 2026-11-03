"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { creatorProgramService } from "@/services/creatorProgram.service";
import { walletsService } from "@/services/wallets.service";
import type { CreatorContentCategory, CreatorSocialLink } from "@/types/creator.type";

import styles from "../program/page.module.css";

const CATEGORIES: readonly CreatorContentCategory[] = ["fashion", "beauty", "tech", "food", "lifestyle", "comedy", "music", "education", "fitness", "parenting"];
const MAXIMUM_CATEGORIES = 3;
const SOCIAL_PLATFORMS: readonly { readonly platform: CreatorSocialLink["platform"]; readonly label: string; readonly placeholder: string }[] = [
  { platform: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourname" },
  { platform: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourname" },
  { platform: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourname" },
];
const MAXIMUM_SAMPLE_LINKS = 3;

export default function CreatorApplyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: ["wallet", "payout-accounts"], queryFn: () => walletsService.listMyPayoutAccounts() });
  const [categories, setCategories] = useState<readonly CreatorContentCategory[]>([]);
  const [socialLinkByPlatform, setSocialLinkByPlatform] = useState<Record<string, string>>({});
  const [sampleContentUrls, setSampleContentUrls] = useState<string[]>([]);
  const [payoutAccountId, setPayoutAccountId] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () => {
      if (categories.length === 0) throw new Error("Pick at least one content category.");
      if (categories.length > MAXIMUM_CATEGORIES) throw new Error(`Pick no more than ${MAXIMUM_CATEGORIES} content categories.`);
      if (!acceptedTerms) throw new Error("Accept the creator terms to continue.");
      return creatorProgramService.submitCreatorApplication({
        contentCategories: categories,
        socialLinks: SOCIAL_PLATFORMS.filter(({ platform }) => socialLinkByPlatform[platform]?.trim()).map(({ platform }) => ({ platform, url: socialLinkByPlatform[platform]!.trim() })),
        sampleContentUrls: sampleContentUrls.map((url) => url.trim()).filter(Boolean),
        ...(payoutAccountId ? { payoutAccountId } : {}),
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
    setCategories((current) => (current.includes(category) ? current.filter((entry) => entry !== category) : current.length < MAXIMUM_CATEGORIES ? [...current, category] : current));
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
          <p>Pick up to {MAXIMUM_CATEGORIES}.</p>
          <div className={styles.chips}>
            {CATEGORIES.map((category) => (
              <button key={category} type="button" className={[styles.chip, categories.includes(category) ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={categories.includes(category)} disabled={categories.length >= MAXIMUM_CATEGORIES && !categories.includes(category)} onClick={() => toggleCategory(category)}>{category}</button>
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Your other social accounts (optional)</h2>
          {SOCIAL_PLATFORMS.map((social) => (
            <label className={styles.field} key={social.platform}>{social.label}
              <input className={styles.input} type="url" value={socialLinkByPlatform[social.platform] ?? ""} onChange={(event) => setSocialLinkByPlatform((current) => ({ ...current, [social.platform]: event.target.value }))} placeholder={social.placeholder} inputMode="url" autoCapitalize="none" />
            </label>
          ))}
        </div>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Sample content links (optional)</h2>
          {sampleContentUrls.map((url, index) => (
            <label className={styles.field} key={`sample-${index}`}>Sample {index + 1}
              <input className={styles.input} type="url" value={url} onChange={(event) => setSampleContentUrls((current) => current.map((entry, entryIndex) => entryIndex === index ? event.target.value : entry))} placeholder="https://" inputMode="url" />
              <button type="button" onClick={() => setSampleContentUrls((current) => current.filter((_, entryIndex) => entryIndex !== index))} aria-label={`Remove sample link ${index + 1}`}>Remove</button>
            </label>
          ))}
          {sampleContentUrls.length < MAXIMUM_SAMPLE_LINKS ? <button type="button" className={styles.chip} onClick={() => setSampleContentUrls((current) => [...current, ""])}>Add sample link</button> : null}
        </div>
        <label className={styles.field}>Payout account (optional)
          <select className={styles.select} value={payoutAccountId} onChange={(event) => setPayoutAccountId(event.target.value)}>
            <option value="">Select account</option>
            {(accounts.data ?? []).map((account) => (
              <option key={account.id} value={account.id}>{account.bankName} · {account.accountNumberMasked}</option>
            ))}
          </select>
          <span>You can apply without one. Earnings remain in your Nantty balance until you add an eligible payout method.</span>
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
