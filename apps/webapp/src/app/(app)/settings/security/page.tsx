"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { PasswordRequirements } from "@/app/(auth)/signup/passwordRequirements";
import { useSession } from "@/components/providers/sessionProvider";
import styles from "@/components/settings/settings.module.css";
import homeStyles from "@/components/settings/settingsHome.module.css";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { AppIcon, IconLabel } from "@/components/ui/appIcon";
import { ChevronRightIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { usersService } from "@/services/users.service";
import { isPasswordStrongEnoughForAccount } from "@/utils/validators.util";

export default function SecuritySettingsPage() {
  const { viewer } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const changePassword = useMutation({
    mutationFn: () => usersService.changeMyPassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      showToast({ text: "Password changed" });
    },
  });
  const confirmationMismatch = confirmation.length > 0 && confirmation !== newPassword;
  const canSave = currentPassword.length > 0 && isPasswordStrongEnoughForAccount(newPassword) && confirmation === newPassword;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSave && !changePassword.isPending) changePassword.mutate();
  };

  return (
    <div className={styles.page}>
      <div>
        <Link href="/settings"><IconLabel name="arrowLeft24" size={16}>Settings</IconLabel></Link>
        <h1 className={styles.title}>Security</h1>
      </div>
      <form className={styles.block} onSubmit={submit} aria-labelledby="password-heading">
        <h2 id="password-heading" className={styles.blockHeading}>Password</h2>
        <TextField label="Current password" placeholder="Enter current password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        <TextField label="New password" placeholder="Enter new password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        <PasswordRequirements password={newPassword} />
        <TextField label="Confirm new password" placeholder="Enter new password again" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} error={confirmationMismatch ? "Passwords don't match" : changePassword.isError ? readErrorMessageForDisplay(changePassword.error) : undefined} />
        <Button type="submit" disabled={!canSave} busy={changePassword.isPending}>Save</Button>
      </form>
      <nav className={homeStyles.card} aria-label="More security settings">
        <ul className={homeStyles.linkList}>
          {[
            { href: viewer ? `/user/${encodeURIComponent(viewer.id)}/connections?tab=blocked` : "/settings", label: "Blocked users", description: "People who can't find you or message you", icon: "prohibit24" as const },
            { href: "/settings/verification", label: "Identity verification", description: "Verify your identity to withdraw and sell", icon: "identification24" as const },
          ].map((link) => (
            <li key={link.label}>
              <Link href={link.href} className={homeStyles.linkRow}>
                <span className={homeStyles.linkIcon}><AppIcon name={link.icon} size={20} /></span>
                <span className={homeStyles.linkText}>
                  <span className={homeStyles.linkLabel}>{link.label}</span>
                  <span className={homeStyles.linkDescription}>{link.description}</span>
                </span>
                <ChevronRightIcon size={18} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
