"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { privacyService } from "@/services/privacy.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";

import styles from "./settings.module.css";
import { businessMessagingScopeDescriptions, getGrantableBusinessMessagingScopes, parseBusinessMessagingConsentRequest } from "./businessMessagingScopes.util";

export function BusinessMessagingConsentView() {
  const searchParams = useSearchParams();
  const requestKey = JSON.stringify([
    searchParams.getAll("applicationId"),
    searchParams.getAll("storeId"),
    searchParams.getAll("redirect_uri"),
    searchParams.getAll("code_challenge"),
    searchParams.getAll("code_challenge_method"),
    searchParams.getAll("state"),
  ]);
  const request = parseBusinessMessagingConsentRequest(
    searchParams.getAll("applicationId"), searchParams.getAll("storeId"), searchParams.getAll("redirect_uri"),
    searchParams.getAll("code_challenge"), searchParams.getAll("code_challenge_method"), searchParams.getAll("state"),
  );

  return <BusinessMessagingConsentRequest key={requestKey} request={request} />;
}

function BusinessMessagingConsentRequest({ request }: { request: ReturnType<typeof parseBusinessMessagingConsentRequest> }) {
  const router = useRouter();
  const applicationId = request?.applicationId ?? "";
  const storeId = request?.storeId ?? "";
  const validRequest = request !== null;
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const preview = useQuery({
    queryKey: ["businessMessaging", "consentPreview", applicationId, storeId, request?.authorization?.redirectUri, request?.authorization?.codeChallenge, request?.authorization?.state],
    queryFn: () => privacyService.previewBusinessMessagingConsent(applicationId, storeId, request?.authorization),
    enabled: validRequest,
    retry: false,
  });
  const grant = useMutation({
    mutationFn: privacyService.grantBusinessMessagingConsent,
  });
  const deny = useMutation({
    mutationFn: ({ application, store }: { application: string; store: string }) =>
      request?.authorization
        ? privacyService.denyBusinessMessagingConsent(application, store, request.authorization)
        : Promise.resolve(null),
  });
  useEffect(() => {
    if (grant.data?.authorizationRedirectUrl) window.location.replace(grant.data.authorizationRedirectUrl);
  }, [grant.data]);
  useEffect(() => {
    if (deny.data?.authorizationRedirectUrl) window.location.replace(deny.data.authorizationRedirectUrl);
    else if (deny.isSuccess) router.replace("/");
  }, [deny.data, deny.isSuccess, router]);
  const availableScopes = getGrantableBusinessMessagingScopes(preview.data?.availableScopes ?? []);

  function toggleScope(scope: string) {
    setSelectedScopes((current) => current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope]);
  }

  if (!validRequest) {
    return <section className={styles.block} aria-labelledby="business-consent-heading">
      <h1 id="business-consent-heading" className={styles.title}>Review business app access</h1>
      <p className={styles.errorText}>This approval link is incomplete or invalid. Ask the app provider for a new link.</p>
      <Link href="/">Return to Nantty</Link>
    </section>;
  }

  if (grant.isSuccess) {
    return <section className={styles.block} aria-labelledby="business-consent-heading" role="status">
      <h1 id="business-consent-heading" className={styles.title}>{grant.data.authorizationRedirectUrl ? "Returning to the business app" : "Access approved"}</h1>
      <p className={styles.muted}>{preview.data?.applicationName} can use the permissions you selected for {preview.data?.storeName}. You can revoke access later in Privacy &amp; Data settings.</p>
      <Link href="/settings/privacy">Open Privacy &amp; Data</Link>
    </section>;
  }

  return <section className={styles.block} aria-labelledby="business-consent-heading">
    <h1 id="business-consent-heading" className={styles.title}>Review business app access</h1>
    <p className={styles.muted}>Only approve permissions you understand. You can revoke access later in Privacy &amp; Data settings.</p>
    {preview.isPending ? <ListRowsSkeleton label="Checking app and store authorization" rows={2} withAvatar={false} /> : null}
    {preview.isError ? <ErrorState description="This app is not approved for this store, or its store authorization is no longer active." error={preview.error} onRetry={() => void preview.refetch()} /> : null}
    {preview.data ? <>
      <article className={styles.notificationCategory} aria-label="Business app details">
        <h2 className={styles.subHeading}>{preview.data.applicationName}</h2>
        <p className={styles.muted}>Developer organization: {preview.data.organizationName}</p>
        <p className={styles.muted}>Store: {preview.data.storeName}</p>
      </article>
      {availableScopes.length === 0 ? <p className={styles.errorText}>This app and store have no permissions available for customer approval.</p> : <fieldset className={styles.radioGroup}>
        <legend className={styles.subHeading}>Choose permissions</legend>
        {availableScopes.map((scope) => <label className={styles.radioRow} key={scope}>
          <input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} />
          <span><strong>{scope}</strong><span className={styles.muted}>{businessMessagingScopeDescriptions[scope]}</span></span>
        </label>)}
      </fieldset>}
      {grant.isError ? <p className={styles.errorText} role="alert">We couldn&apos;t save your approval: {readErrorMessageForDisplay(grant.error)}. No permission was confirmed; you can retry.</p> : null}
      {deny.isError ? <p className={styles.errorText} role="alert">We couldn&apos;t return to the requesting app: {readErrorMessageForDisplay(deny.error)}. No permission was granted; you can retry or return to Nantty.</p> : null}
      <div className={styles.buttonRow}>
        <Button busy={grant.isPending} disabled={deny.isPending || !selectedScopes.length || !availableScopes.length} onClick={() => grant.mutate({
          organizationId: preview.data.organizationId,
          applicationId: preview.data.applicationId,
          storeId: preview.data.storeId,
          scopes: selectedScopes,
          ...(request?.authorization ? { authorization: request.authorization } : {}),
        })}>Approve selected access</Button>
        <Button variant="quiet" busy={deny.isPending} disabled={grant.isPending} onClick={() => deny.mutate({ application: applicationId, store: storeId })}>Not now</Button>
      </div>
    </> : null}
  </section>;
}
