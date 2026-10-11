"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { sellerService } from "@/services/seller.service";

import styles from "../page.module.css";

export default function SellerApplicationPage() {
  const existing = useQuery({ queryKey: ["seller", "application"], queryFn: () => sellerService.fetchMySellerApplication() });
  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setStateValue] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentPhotoUrl, setDocumentPhotoUrl] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () =>
      sellerService.submitSellerApplication({
        storeName: storeName.trim(),
        categoryId: "general",
        description: description.trim(),
        phone: phone.trim(),
        addressLine: addressLine.trim(),
        city: city.trim(),
        state: state.trim(),
        identityDocument: { documentType: "nin_slip", documentNumber: documentNumber.trim(), documentPhotoUrl: documentPhotoUrl.trim() },
        payoutAccount: { bankCode: bankCode.trim(), accountNumber: accountNumber.trim() },
      }),
    onSuccess: () => {
      setError(null);
      void existing.refetch();
      showToast({ text: "Application submitted" });
    },
    onError: (mutationError) => setError(readErrorMessageForDisplay(mutationError)),
  });
  if (existing.isLoading) return <ListRowsSkeleton label="Loading application" rows={4} />;
  if (existing.isError) return <ErrorState description="We couldn't load your application." error={existing.error} onRetry={() => void existing.refetch()} />;
  if (existing.data) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Seller application</h1>
        <div className={styles.card}>
          <span className={styles.label}>Status</span>
          <span className={styles.value}>{existing.data.status}</span>
          <span className={styles.rowMeta}>{existing.data.storeName} · {existing.data.city}, {existing.data.state}</span>
          {existing.data.rejectionReason ? <span className={styles.rowMeta}>{existing.data.rejectionReason}</span> : null}
        </div>
      </div>
    );
  }
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Become a seller</h1>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
      >
        <label className={styles.field}>Store name
          <input className={styles.input} value={storeName} onChange={(event) => setStoreName(event.target.value)} required />
        </label>
        <label className={styles.field}>Description
          <textarea className={styles.textarea} value={description} onChange={(event) => setDescription(event.target.value)} required />
        </label>
        <label className={styles.field}>Phone
          <input className={styles.input} value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </label>
        <label className={styles.field}>Address
          <input className={styles.input} value={addressLine} onChange={(event) => setAddressLine(event.target.value)} required />
        </label>
        <label className={styles.field}>City
          <input className={styles.input} value={city} onChange={(event) => setCity(event.target.value)} required />
        </label>
        <label className={styles.field}>State
          <input className={styles.input} value={state} onChange={(event) => setStateValue(event.target.value)} required />
        </label>
        <label className={styles.field}>ID number
          <input className={styles.input} value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} required />
        </label>
        <label className={styles.field}>ID photo URL
          <input className={styles.input} value={documentPhotoUrl} onChange={(event) => setDocumentPhotoUrl(event.target.value)} placeholder="Upload in the app, paste URL here" required />
        </label>
        <label className={styles.field}>Payout bank code
          <input className={styles.input} value={bankCode} onChange={(event) => setBankCode(event.target.value)} required />
        </label>
        <label className={styles.field}>Payout account number
          <input className={styles.input} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} required />
        </label>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button type="submit" className={styles.primary} disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit application"}</button>
      </form>
    </div>
  );
}
