"use client";

import { useEffect, useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { NoticeBanner } from "@/components/ui/feedback";
import { SelectField, TextField, readIssueMessageForField } from "@/components/ui/formFields";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { previewUsernameConfusables } from "@/services/peopleApi.service";
import { createAccountAsAdmin } from "@/services/safetyApi.service";
import type { AdminCreatedAccount, ProfileType } from "@/types/accountsAdmin.type";

const countryOptions = [{ value: "NG", label: "Nigeria" }, { value: "GH", label: "Ghana" }, { value: "KE", label: "Kenya" }, { value: "ZA", label: "South Africa" }, { value: "GB", label: "United Kingdom" }, { value: "US", label: "United States" }];

const profileOptions = [{ value: "PERSONAL", label: "Personal" }, { value: "BUSINESS", label: "Business" }, { value: "BRAND", label: "Brand" }, { value: "GOVERNMENT", label: "Government" }];

export function CreateAccountDialog({ onClose, onCreated }: { readonly onClose: () => void; readonly onCreated: (account: AdminCreatedAccount) => void }) {
  const [username, setUsername] = useState("");
  const [debouncedUsername, setDebouncedUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("NG");
  const [profileType, setProfileType] = useState<ProfileType>("PERSONAL");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUsername(username.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [username]);
  const preview = useAdminQuery((signal) => previewUsernameConfusables(debouncedUsername, signal), debouncedUsername, debouncedUsername.length >= 3);
  const mutation = useAdminMutation((reason: string) => createAccountAsAdmin({ username, displayName, email, password, country, profileType, reason }));
  const reservedHits = preview.data && debouncedUsername.length >= 3 ? preview.data.collisions : [];
  const isReady = username.trim().length >= 3 && displayName.trim().length >= 2 && email.includes("@") && password.length >= 12;

  async function confirm(reason: string) {
    const created = await mutation.run(reason);
    if (created) onCreated(created);
  }

  return (
    <ConfirmActionDialog intent="addMember"
      isOpen
      title="Create an account"
      description="Use this for official, partner or support accounts. The password is shown nowhere after this step."
      consequences={["The reserved-username check is skipped for the name you choose.", "The person must set a new password the first time they sign in.", "Creation is audited with your name and reason. The password is never stored in the log."]}
      confirmLabel="Create account"
      requiresStepUp
      isConfirmDisabled={!isReady}
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirm}
      onClose={() => { mutation.clearError(); onClose(); }}
    >
      <TextField label="Username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" spellCheck={false} error={readIssueMessageForField(mutation.validationIssues, "username")} />
      {reservedHits.length > 0 ? <NoticeBanner tone="caution" title="Reserved name">This matches {reservedHits.map((hit) => hit.value).join(", ")}. You can still create it because you are an admin.</NoticeBanner> : null}
      <TextField label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} error={readIssueMessageForField(mutation.validationIssues, "displayName")} />
      <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" error={readIssueMessageForField(mutation.validationIssues, "email")} />
      <TextField label="Temporary password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" hint="At least 12 characters with upper case, lower case and a number." error={readIssueMessageForField(mutation.validationIssues, "password")} />
      <SelectField label="Profile type" value={profileType} onChange={(event) => setProfileType(event.target.value as ProfileType)} options={profileOptions} hint="Decides which checkmark it can ever hold: Blue for personal (including creator accounts), Gold for business and brand, Black for government." />
      <SelectField label="Country" value={country} onChange={(event) => setCountry(event.target.value)} options={countryOptions} />
    </ConfirmActionDialog>
  );
}
