"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import styles from "@/components/settings/settings.module.css";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { verificationShopService } from "@/services/verification.service";
import type { BlackApplicationInput } from "@/types/verification.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export function GovernmentBlackHub({ profileId }: { readonly profileId: string }) {
  const queryClient = useQueryClient();
  const mineQuery = useQuery({ queryKey: ["verification", "me"], queryFn: () => verificationShopService.fetchMyVerification() });
  const billingQuery = useQuery({
    queryKey: ["verification", "black", "billing", profileId],
    queryFn: () => verificationShopService.fetchGovernmentBlackBilling(profileId),
    enabled: Boolean(mineQuery.data?.blackApplication),
    retry: false,
  });
  const savedCardsQuery = useQuery({ queryKey: ["payments", "savedCards"], queryFn: () => verificationShopService.listSavedCards(), retry: false });

  const [form, setForm] = useState<BlackApplicationInput>({
    agencyName: "", legalIdentityName: "", legalRegistrationRef: "", jurisdictionCountryCode: "NG",
    officialWebsite: "", officialContactPhone: "", institutionalEmail: "", representativeName: "",
    representativeRole: "", representativeEmail: "", representativeIdRef: "", evidenceNotes: "",
  });
  const [otpCode, setOtpCode] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [appealDetails, setAppealDetails] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [recurringConsent, setRecurringConsent] = useState(false);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["verification"] });
    void queryClient.invalidateQueries({ queryKey: ["payments", "savedCards"] });
  };

  const applyMutation = useMutation({
    mutationFn: () => verificationShopService.submitBlackApplication(form),
    onSuccess: () => { showToast({ text: "Application submitted. Verify your institutional email." }); refreshAll(); },
  });
  const sendOtpMutation = useMutation({
    mutationFn: (id: string) => verificationShopService.sendBlackEmailOtp(id),
    onSuccess: () => showToast({ text: "Verification code sent to institutional email." }),
  });
  const verifyOtpMutation = useMutation({
    mutationFn: (id: string) => verificationShopService.verifyBlackEmailOtp(id, otpCode),
    onSuccess: () => { setOtpCode(""); showToast({ text: "Institutional email verified. Under admin vetting." }); refreshAll(); },
  });
  const appealMutation = useMutation({
    mutationFn: (id: string) => verificationShopService.submitBlackAppeal(id, { reason: appealReason, supportingDetails: appealDetails }),
    onSuccess: () => { setAppealReason(""); setAppealDetails(""); showToast({ text: "Appeal submitted for staff review." }); refreshAll(); },
  });
  const checkoutMutation = useMutation({
    mutationFn: () => verificationShopService.startGovernmentBlackCheckout({
      profileId, termsAccepted, recurringConsent, returnTo: `${window.location.origin}/settings/verification`,
    }),
    onSuccess: (res) => { if (res.authorizationUrl) window.location.assign(res.authorizationUrl); else refreshAll(); },
  });
  const replaceCardMutation = useMutation({
    mutationFn: () => verificationShopService.startGovernmentBlackCardReplacement({ profileId, returnTo: `${window.location.origin}/settings/verification` }),
    onSuccess: (res) => { if (res.authorizationUrl) window.location.assign(res.authorizationUrl); else refreshAll(); },
  });
  const removeCardMutation = useMutation({
    mutationFn: (authorizationId: string) => verificationShopService.deleteSavedCard(authorizationId),
    onSuccess: () => { showToast({ text: "Card removed. Black entitlement paused until a valid card is added." }); refreshAll(); },
  });
  const reactivateMutation = useMutation({
    mutationFn: () => verificationShopService.reactivateGovernmentBlack(profileId),
    onSuccess: (res) => {
      if (res.actionUrl) window.location.assign(res.actionUrl);
      else { showToast({ text: "Black subscription reactivated." }); refreshAll(); }
    },
  });
  const cancelMutation = useMutation({
    mutationFn: () => verificationShopService.cancelGovernmentBlack(profileId),
    onSuccess: () => { showToast({ text: "Cancellation scheduled at period end." }); refreshAll(); },
  });

  const blackApp = mineQuery.data?.blackApplication;
  const current = mineQuery.data?.current;
  const billing = billingQuery.data;

  const handleApply = (event: FormEvent) => {
    event.preventDefault();
    applyMutation.mutate();
  };

  if (!blackApp) {
    return (
      <section className={styles.block} aria-labelledby="black-gov-apply">
        <h2 id="black-gov-apply" className={styles.blockHeading}>Black checkmark — government verification</h2>
        <p className={styles.muted}>Black verification is strictly for verified government agencies and public institutions. Submit official entity details and verify your institutional email. Private USD monthly billing becomes available only after two independent admin approvals.</p>
        <form onSubmit={handleApply} style={{ display: "grid", gap: "0.75rem" }}>
          <label>Agency / institution name <input required value={form.agencyName} onChange={(e) => setForm({ ...form, agencyName: e.target.value })} /></label>
          <label>Legal entity name <input required value={form.legalIdentityName} onChange={(e) => setForm({ ...form, legalIdentityName: e.target.value })} /></label>
          <label>Legal registration / charter reference <input value={form.legalRegistrationRef ?? ""} onChange={(e) => setForm({ ...form, legalRegistrationRef: e.target.value })} /></label>
          <label>Verified legal jurisdiction (ISO-2 country code, e.g. NG, US, GB) <input required maxLength={2} value={form.jurisdictionCountryCode} onChange={(e) => setForm({ ...form, jurisdictionCountryCode: e.target.value.toUpperCase() })} /></label>
          <label>Institutional email (.gov / official domain) <input required type="email" value={form.institutionalEmail} onChange={(e) => setForm({ ...form, institutionalEmail: e.target.value })} /></label>
          <label>Official website <input value={form.officialWebsite ?? ""} onChange={(e) => setForm({ ...form, officialWebsite: e.target.value })} /></label>
          <label>Official contact phone <input value={form.officialContactPhone ?? ""} onChange={(e) => setForm({ ...form, officialContactPhone: e.target.value })} /></label>
          <label>Authorized representative full name <input required value={form.representativeName} onChange={(e) => setForm({ ...form, representativeName: e.target.value })} /></label>
          <label>Representative role / title <input required value={form.representativeRole} onChange={(e) => setForm({ ...form, representativeRole: e.target.value })} /></label>
          <label>Representative email <input type="email" value={form.representativeEmail ?? ""} onChange={(e) => setForm({ ...form, representativeEmail: e.target.value })} /></label>
          <label>Evidence / gazette notes <textarea value={form.evidenceNotes ?? ""} onChange={(e) => setForm({ ...form, evidenceNotes: e.target.value })} /></label>
          {applyMutation.isError ? <p className={styles.errorText} role="alert">{readErrorMessageForDisplay(applyMutation.error)}</p> : null}
          <div className={styles.buttonRow}><Button type="submit" busy={applyMutation.isPending}>Submit government verification</Button></div>
        </form>
      </section>
    );
  }

  return (
    <>
      <section className={styles.block} aria-labelledby="black-gov-status">
        <h2 id="black-gov-status" className={styles.blockHeading}>Government verification · {blackApp.agencyName}</h2>
        <p className={styles.muted}>Status: <strong>{blackApp.status}</strong> · Jurisdiction: <strong>{blackApp.jurisdictionCountryCode}</strong> · Handle reserved: <strong>{blackApp.handleReserved ? "Yes" : "Pending approval"}</strong></p>
        {current ? <p className={styles.muted}>Badge status: <strong>{current.badgeVisible ? "Visible on profile" : `Hidden (${current.status})`}</strong></p> : null}
        {blackApp.reverificationDueAt ? <p className={styles.muted}>Next re-verification due: {new Date(blackApp.reverificationDueAt).toLocaleDateString()}</p> : null}
        {blackApp.decisionReason ? <p className={styles.muted}>Review note: {blackApp.decisionReason}</p> : null}

        {!blackApp.institutionalEmailVerified ? (
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
            <p className={styles.muted}>Confirm institutional email ownership for <strong>{blackApp.institutionalEmail}</strong>. Confirming your email unlocks review only — it does not grant approval or the badge.</p>
            <div className={styles.buttonRow}>
              <Button variant="secondary" busy={sendOtpMutation.isPending} onClick={() => sendOtpMutation.mutate(blackApp.id)}>Send 6-digit code</Button>
            </div>
            <label>Verification code <input value={otpCode} maxLength={6} placeholder="123456" onChange={(e) => setOtpCode(e.target.value)} /></label>
            <div className={styles.buttonRow}>
              <Button busy={verifyOtpMutation.isPending} disabled={otpCode.trim().length < 6} onClick={() => verifyOtpMutation.mutate(blackApp.id)}>Verify institutional email</Button>
            </div>
            {verifyOtpMutation.isError ? <p className={styles.errorText} role="alert">{readErrorMessageForDisplay(verifyOtpMutation.error)}</p> : null}
          </div>
        ) : null}
      </section>

      {billing?.pricing && billing.disclosures && !billing.subscription ? (
        <section className={styles.block} aria-labelledby="black-private-checkout">
          <h2 id="black-private-checkout" className={styles.blockHeading}>Private Black USD Monthly Checkout</h2>
          <p className={styles.muted}>Verified jurisdiction ({billing.verification.jurisdictionCountryCode}): <strong>{formatMoneyForDisplay(billing.pricing.price)} / month</strong> (USD only, web only, discounts &amp; annual billing disabled).</p>
          <ul className={styles.bulletList}>
            <li>{billing.disclosures.billingCadence}</li>
            <li>{billing.disclosures.autoRenewalTerms}</li>
            <li>{billing.disclosures.cancellationTerms}</li>
            <li>{billing.disclosures.failureConsequences}</li>
            <li>{billing.disclosures.cardRemovalConsequences}</li>
          </ul>
          <label className={styles.radioRow}><input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} /><span>I accept the recurring USD monthly billing terms and disclosures.</span></label>
          <label className={styles.radioRow}><input type="checkbox" checked={recurringConsent} onChange={(e) => setRecurringConsent(e.target.checked)} /><span>I authorize Nantty to save and charge my recurring USD card monthly until cancelled or paused.</span></label>
          {checkoutMutation.isError ? <p className={styles.errorText} role="alert">{readErrorMessageForDisplay(checkoutMutation.error)}</p> : null}
          <div className={styles.buttonRow}>
            <Button busy={checkoutMutation.isPending} disabled={!termsAccepted || !recurringConsent || !billing.verification.privateCheckoutEnabled} onClick={() => checkoutMutation.mutate()}>Proceed to private USD checkout</Button>
          </div>
        </section>
      ) : null}

      {billing?.subscription ? (
        <section className={styles.block} aria-labelledby="black-billing-dash">
          <h2 id="black-billing-dash" className={styles.blockHeading}>Government Black Billing &amp; Payment Method</h2>
          <p className={styles.muted}>Subscription: <strong>{billing.subscription.status}</strong>{billing.subscription.pausedReason ? ` (${billing.subscription.pausedReason})` : ""} · Card: <strong>{billing.subscription.cardLabel || "None attached"}</strong></p>
          {billing.subscription.nextChargeAt ? <p className={styles.muted}>Next charge: {new Date(billing.subscription.nextChargeAt).toLocaleDateString()}</p> : null}
          <div className={styles.buttonRow}>
            <Button variant="secondary" busy={replaceCardMutation.isPending} onClick={() => replaceCardMutation.mutate()}>Replace recurring card</Button>
            {billing.subscription.status === "paused" || billing.subscription.status === "past_due" || billing.subscription.status === "canceled" ? (
              <Button busy={reactivateMutation.isPending} onClick={() => reactivateMutation.mutate()}>Reactivate Black subscription</Button>
            ) : null}
            {billing.subscription.status === "active" && !billing.subscription.cancelAtPeriodEnd ? (
              <Button variant="secondary" busy={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>Cancel at period end</Button>
            ) : null}
          </div>
          {(savedCardsQuery.data ?? []).length > 0 ? (
            <ul className={styles.bulletList}>
              {(savedCardsQuery.data ?? []).map((card) => (
                <li key={card.authorizationId}>
                  {card.cardLabel} ({card.expiryMonth}/{card.expiryYear}) —{" "}
                  <button type="button" onClick={() => removeCardMutation.mutate(card.authorizationId)}>Remove card (pauses Black)</button>
                </li>
              ))}
            </ul>
          ) : null}
          {billing.invoices.length > 0 ? (
            <ul className={styles.bulletList}>
              {billing.invoices.map((inv) => (
                <li key={inv.id}>{inv.invoiceNumber} · {inv.status} · {formatMoneyForDisplay(inv.amount)}{inv.failureReason ? ` (${inv.failureReason})` : ""}</li>
              ))}
            </ul>
          ) : null}
          {reactivateMutation.isError ? <p className={styles.errorText} role="alert">{readErrorMessageForDisplay(reactivateMutation.error)}</p> : null}
        </section>
      ) : null}

      {(blackApp.status === "REJECTED" || blackApp.status === "REVOKED" || blackApp.status === "REVERIFICATION_REQUIRED") ? (
        <section className={styles.block} aria-labelledby="black-appeals">
          <h2 id="black-appeals" className={styles.blockHeading}>Appeal or submit re-verification update</h2>
          <label>Reason <input value={appealReason} onChange={(e) => setAppealReason(e.target.value)} /></label>
          <label>Supporting documentation / context <textarea value={appealDetails} onChange={(e) => setAppealDetails(e.target.value)} /></label>
          {appealMutation.isError ? <p className={styles.errorText} role="alert">{readErrorMessageForDisplay(appealMutation.error)}</p> : null}
          <div className={styles.buttonRow}>
            <Button variant="secondary" busy={appealMutation.isPending} disabled={appealReason.trim().length < 8} onClick={() => appealMutation.mutate(blackApp.id)}>Submit appeal</Button>
          </div>
        </section>
      ) : null}
    </>
  );
}
