"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout } from "@/components/ui/feedback";
import { CheckboxField, FormErrorSummary, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import { apiKeyScopes, type ApiKey, type ApiKeyScope, type CreatedApiKey } from "@/types/developer.type";
import type { CursorPage } from "@/types/pagination.type";
import { formatDateForDisplay, formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./settings.module.css";

export function OneTimeSecretNotice({ label, secret }: { readonly label: string; readonly secret: string }) {
  const { showToast } = useToast();
  return (
    <div className={styles.formStack}>
      <Callout tone="caution" title="Copy it now">This is the only time we show the full {label}. Store it somewhere safe, like your password manager.</Callout>
      <div className={styles.secretBox}>
        <span>{secret}</span>
        <Button size="small" iconName="copy16" onClick={() => void navigator.clipboard.writeText(secret).then(() => showToast("Copied."), () => showToast("Copy it by hand.", "error"))}>
          Copy
        </Button>
      </div>
    </div>
  );
}

function CreateApiKeyDialog({ onClose, onCreated }: { readonly onClose: () => void; readonly onCreated: (created: CreatedApiKey) => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiKeyScope[]>(["orders:read", "products:read"]);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  async function createApiKey() {
    const problems = [name.trim().length < 2 ? "Give the key a name so you know where it is used." : null, scopes.length === 0 ? "Pick at least one scope." : null].filter((problem): problem is string => problem !== null);
    setErrorMessages(problems);
    if (problems.length > 0) return;
    setIsCreating(true);
    try {
      onCreated(await sendSellerApiRequest<CreatedApiKey>("/seller/developers/api-keys", { method: "POST", body: { name: name.trim(), scopes } }));
    } catch (error) {
      setErrorMessages([readErrorMessageForDisplay(error)]);
      setIsCreating(false);
    }
  }

  return (
    <ModalDialog intent="key" isOpen onClose={onClose} title="New API key" description="Keys act as your store. Give each tool its own key and only the scopes it needs." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" isBusy={isCreating} onClick={() => void createApiKey()}>Create key</Button></>}>
      <div className={styles.formStack}>
        <FormErrorSummary messages={errorMessages} />
        <TextField label="Name" value={name} maxLength={60} placeholder="Warehouse system" onChange={(event) => setName(event.target.value)} />
        <div className={styles.checkboxGrid} role="group" aria-label="Scopes">
          {apiKeyScopes.map((scope) => (
            <CheckboxField key={scope} label={<span className={styles.monospace}>{scope}</span>} checked={scopes.includes(scope)} onCheckedChange={(isOn) => setScopes((current) => (isOn ? [...current, scope] : current.filter((candidate) => candidate !== scope)))} />
          ))}
        </div>
      </div>
    </ModalDialog>
  );
}

export function DeveloperApiKeysPanel() {
  const apiKeysQuery = useSellerQuery<CursorPage<ApiKey>>("/seller/developers/api-keys");
  const { showToast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [keyPendingRevoke, setKeyPendingRevoke] = useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  async function revokeApiKey() {
    if (!keyPendingRevoke) return;
    setIsRevoking(true);
    try {
      await sendSellerApiRequest(`/seller/developers/api-keys/${encodeURIComponent(keyPendingRevoke.id)}`, { method: "DELETE" });
      showToast(`Revoked ${keyPendingRevoke.name}. Anything using it stops working now.`);
      setKeyPendingRevoke(null);
      apiKeysQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <Panel title="API keys" description="Use these with the Zudomart Seller API. Send the key in the Authorization header." padded={false} actions={<Button variant="primary" size="small" iconName="plus16" onClick={() => setIsCreating(true)}>New key</Button>}>
      <DataTable<ApiKey>
        caption="API keys"
        rows={apiKeysQuery.data?.data ?? null}
        isLoading={apiKeysQuery.isLoading}
        errorMessage={apiKeysQuery.errorMessage}
        onRetry={apiKeysQuery.reload}
        readRowKey={(apiKey) => apiKey.id}
        emptyState="No API keys yet."
        columns={[
          { key: "name", header: "Name", render: (apiKey) => <span className={styles.rowTitle}>{apiKey.name}<span className={styles.monospace}>{apiKey.prefix}••••</span></span> },
          { key: "scopes", header: "Scopes", hideBelowTablet: true, render: (apiKey) => <span className={styles.monospace}>{apiKey.scopes.join(", ")}</span> },
          { key: "created", header: "Created", hideBelowTablet: true, render: (apiKey) => `${formatDateForDisplay(apiKey.createdAt)} by ${apiKey.createdBy}` },
          { key: "used", header: "Last used", render: (apiKey) => (apiKey.lastUsedAt ? formatRelativeTimeFromNow(apiKey.lastUsedAt) : "Never") },
          { key: "action", header: <span className="visuallyHidden">Action</span>, align: "end", render: (apiKey) => <Button size="small" variant="ghost" onClick={() => setKeyPendingRevoke(apiKey)}>Revoke</Button> },
        ]}
      />
      {isCreating ? <CreateApiKeyDialog onClose={() => setIsCreating(false)} onCreated={(created) => { setIsCreating(false); setCreatedKey(created); apiKeysQuery.reload(); }} /> : null}
      <ModalDialog intent="success" isOpen={createdKey !== null} onClose={() => setCreatedKey(null)} title={`Key created: ${createdKey?.apiKey.name ?? ""}`} footer={<Button variant="primary" onClick={() => setCreatedKey(null)}>I have copied it</Button>}>
        {createdKey ? <OneTimeSecretNotice label="API key" secret={createdKey.secret} /> : null}
      </ModalDialog>
      <ModalDialog intent="key" isOpen={keyPendingRevoke !== null} onClose={() => setKeyPendingRevoke(null)} width="small" title={`Revoke ${keyPendingRevoke?.name ?? "this key"}?`} footer={<><Button onClick={() => setKeyPendingRevoke(null)}>Keep it</Button><Button variant="danger" isBusy={isRevoking} onClick={() => void revokeApiKey()}>Revoke key</Button></>}>
        Any tool using this key loses access straight away. This cannot be undone.
      </ModalDialog>
    </Panel>
  );
}
