"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { ErrorState } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/field";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { privacyService, type BusinessMessagingApplicationPreview, type BusinessMessagingStoreAuthorization } from "@/services/privacy.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { storesService } from "@/services/stores.service";

import styles from "./settings.module.css";

const authorizationsKey = ["privacy", "businessMessagingAuthorizations"] as const;
const storesKey = ["businessMessaging", "authorizedStores"] as const;
const scopeDescriptions: Readonly<Record<string, string>> = {
  "messages:send": "Send messages to customers who have consented to this business conversation.",
  "messages:read": "Read messages covered by the business messaging consent rules.",
  "conversations:read": "View conversations associated with this store.",
};

export function BusinessMessagingStoreAuthorizationsSection() {
  const queryClient = useQueryClient();
  const [applicationId, setApplicationId] = useState("");
  const [preview, setPreview] = useState<BusinessMessagingApplicationPreview | null>(null);
  const [storeId, setStoreId] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const authorizations = useQuery({ queryKey: authorizationsKey, queryFn: privacyService.fetchBusinessMessagingAuthorizations, retry: false });
  const stores = useQuery({ queryKey: storesKey, queryFn: storesService.fetchMyStores, enabled: Boolean(preview), retry: false });
  const grantableScopes = (preview?.requestedScopes ?? []).filter((scope) => scope in scopeDescriptions);

  const lookup = useMutation({
    mutationFn: privacyService.previewBusinessMessagingApplication,
    onSuccess: (result) => {
      setPreview(result);
      setSelectedScopes([]);
      setStoreId("");
      void queryClient.invalidateQueries({ queryKey: storesKey });
    },
    onError: (error) => {
      setPreview(null);
      showToast({ text: readErrorMessageForDisplay(error), tone: "error" });
    },
  });
  const grant = useMutation({
    mutationFn: privacyService.grantBusinessMessagingAuthorization,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authorizationsKey });
      showToast({ text: "Store access granted to the approved app" });
      setPreview(null);
      setApplicationId("");
      setStoreId("");
      setSelectedScopes([]);
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  const revoke = useMutation({
    mutationFn: privacyService.revokeBusinessMessagingAuthorization,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authorizationsKey });
      showToast({ text: "Store app access revoked" });
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });

  function toggleScope(scope: string) {
    setSelectedScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  }

  async function confirmRevoke(authorization: BusinessMessagingStoreAuthorization) {
    const confirmed = await requestConfirmation({
      title: `Disconnect ${authorization.applicationName} from ${authorization.storeName}?`,
      description: "The app will lose the permissions listed here. This does not delete your store or customer conversations.",
      confirmLabel: "Disconnect app",
    });
    if (confirmed) revoke.mutate(authorization.id);
  }

  return (
    <section className={styles.block} aria-labelledby="business-store-app-access-heading">
      <h2 id="business-store-app-access-heading" className={styles.blockHeading}>Store app access</h2>
      <p className={styles.muted}>Connect an approved Nantty Business Messaging integration to a store you manage. You choose the store and each permission; access can be revoked here at any time.</p>

      <form className={styles.businessGrantForm} onSubmit={(event) => { event.preventDefault(); lookup.mutate(applicationId.trim()); }}>
        <TextField label="Developer application ID" value={applicationId} onChange={(event) => setApplicationId(event.target.value)} autoComplete="off" spellCheck={false} hint="Ask the integration provider for its Nantty application ID. We will show its approved name and requested permissions before you grant access." />
        <div className={styles.buttonRow}><Button type="submit" variant="secondary" busy={lookup.isPending} disabled={!applicationId.trim()}>Review app</Button></div>
      </form>

      {preview ? <div className={styles.businessGrantPreview} aria-live="polite">
        <h3 className={styles.subHeading}>{preview.applicationName}</h3>
        <p className={styles.muted}>Developer organization: {preview.organizationName}</p>
        <p className={styles.muted}>Only approve permissions needed for this integration. Requested permissions:</p>
        {grantableScopes.length === 0 ? <p className={styles.errorText}>This app has not requested any permissions that can currently be granted for store messaging.</p> : <fieldset className={styles.radioGroup}>
          <legend className={styles.subHeading}>Permissions to grant</legend>
          {grantableScopes.map((scope) => <label className={styles.radioRow} key={scope}>
            <input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} />
            <span><strong>{scope}</strong><span className={styles.muted}>{scopeDescriptions[scope] ?? "Permission requested by this approved application."}</span></span>
          </label>)}
          {preview.requestedScopes.filter((scope) => !(scope in scopeDescriptions)).map((scope) => <p className={styles.muted} key={scope}>{scope}: not currently available for store authorization.</p>)}
        </fieldset>}
        {stores.isPending ? <ListRowsSkeleton label="Loading stores you can manage" rows={2} withAvatar={false} /> : null}
        {stores.isError ? <ErrorState description="We couldn't load stores available to your account." error={stores.error} onRetry={() => void stores.refetch()} /> : null}
        {stores.data ? stores.data.length === 0 ? <p className={styles.muted}>No stores are available to connect from this account.</p> : <SelectField label="Store to connect" value={storeId} onChange={(event) => setStoreId(event.target.value)}>
          <option value="">Choose a store</option>
          {stores.data.map((store) => <option key={store.storeId} value={store.storeId}>{store.storeName} · {store.role}</option>)}
        </SelectField> : null}
        <div className={styles.buttonRow}>
          <Button busy={grant.isPending} disabled={!storeId || selectedScopes.length === 0 || !grantableScopes.length} onClick={() => grant.mutate({ organizationId: preview.organizationId, applicationId: preview.applicationId, storeId, scopes: selectedScopes })}>Grant selected access</Button>
          <Button variant="quiet" onClick={() => setPreview(null)}>Cancel</Button>
        </div>
      </div> : null}

      <h3 className={styles.subHeading}>Connected store apps</h3>
      {authorizations.isPending ? <ListRowsSkeleton label="Loading connected store apps" rows={2} withAvatar={false} /> : null}
      {authorizations.isError ? <ErrorState description="We couldn't load store app access." error={authorizations.error} onRetry={() => void authorizations.refetch()} /> : null}
      {authorizations.data?.length === 0 ? <p className={styles.muted}>No developer apps are connected to your stores.</p> : null}
      {authorizations.data?.map((authorization) => <article key={authorization.id} className={styles.notificationCategory} aria-label={`${authorization.applicationName} store access`}>
        <div>
          <h3 className={styles.subHeading}>{authorization.applicationName} · {authorization.storeName}</h3>
          <p className={styles.muted}>{authorization.organizationName} · {authorization.status === "active" ? "Access active" : "Access revoked"}</p>
          <p className={styles.muted}>Permissions: {authorization.scopes.join(", ") || "None"}</p>
          <p className={styles.muted}>Granted {new Date(authorization.grantedAt).toLocaleDateString()}</p>
        </div>
        {authorization.status === "active" ? <div className={styles.buttonRow}><Button variant="danger" busy={revoke.isPending && revoke.variables === authorization.id} disabled={revoke.isPending} onClick={() => void confirmRevoke(authorization)}>Disconnect app</Button></div> : null}
      </article>)}
    </section>
  );
}
