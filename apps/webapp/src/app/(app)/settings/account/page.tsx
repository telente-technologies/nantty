"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { signOut } from "@/components/profile/profileView";
import styles from "@/components/settings/settings.module.css";
import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { TextField } from "@/components/ui/field";
import { AppIcon, IconLabel } from "@/components/ui/appIcon";
import { showToast } from "@/components/ui/toast";
import { authService } from "@/services/auth.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { usersService } from "@/services/users.service";

const POLICY_NOTES = [
  "Some usernames are reserved for Nantty and can't be used.",
  "Nantty may withhold or reclaim a username that violates our policies, impersonates someone or is needed for legal reasons.",
];

function useUsernameAvailability(candidate: string, current: string | undefined) {
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(candidate.trim().replace(/^@/, "")), 350);
    return () => clearTimeout(timer);
  }, [candidate]);
  const isUnchanged = debounced.toLowerCase() === (current ?? "").toLowerCase();
  const query = useQuery({ queryKey: ["usernameAvailable", debounced], queryFn: () => authService.checkUsernameAvailability(debounced), enabled: debounced.length >= 3 && !isUnchanged, retry: false });
  const message = isUnchanged && debounced ? "That's already your username." : query.data && !query.data.available ? `@${debounced} isn't available.${query.data.suggestions?.length ? ` Try @${query.data.suggestions[0]}.` : ""}` : query.data?.available ? `@${debounced} is available.` : null;
  return { isAvailable: query.data?.available === true && !isUnchanged && debounced === candidate.trim().replace(/^@/, ""), message };
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["profile", "me"], queryFn: () => usersService.fetchMyProfile(), retry: false });
  const settings = useQuery({ queryKey: ["users", "me", "settings"], queryFn: usersService.fetchMyAccountSettings, retry: false });
  const policy = useQuery({ queryKey: ["users", "me", "username-policy"], queryFn: usersService.fetchMyUsernamePolicy, retry: false });
  const [username, setUsername] = useState("");
  const availability = useUsernameAvailability(username, profile.data?.username);
  const changeUsername = useMutation({
    mutationFn: () => usersService.changeMyUsername(username.trim().replace(/^@/, "")),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile", "me"], updated);
      void queryClient.invalidateQueries({ queryKey: ["users", "me", "username-policy"] });
      setUsername("");
      showToast({ text: `You're now @${updated.username}` });
      router.refresh();
    },
  });
  const deactivate = useMutation({
    mutationFn: async () => {
      await usersService.deactivateMyAccount();
      await signOut().catch(() => undefined);
    },
    onSuccess: () => {
      router.push("/login");
      router.refresh();
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  const canChange = policy.data?.canChangeNow ?? false;

  const submitUsername = (event: FormEvent) => {
    event.preventDefault();
    if (!canChange || !availability.isAvailable || changeUsername.isPending) return;
    changeUsername.mutate();
  };
  const confirmDeactivate = async () => {
    const confirmed = await requestConfirmation({ title: "Deactivate account?", description: "Your profile and store will be hidden until you log in again.", confirmLabel: "Deactivate", tone: "danger", icon: <AppIcon name="userMinus24" size={22} /> });
    if (confirmed) deactivate.mutate();
  };

  return (
    <div className={styles.page}>
      <div>
        <Link href="/settings"><IconLabel name="arrowLeft24" size={16}>Settings</IconLabel></Link>
        <h1 className={styles.title}>Account</h1>
      </div>
      <form className={styles.block} onSubmit={submitUsername} aria-labelledby="username-heading">
        <h2 id="username-heading" className={styles.blockHeading}>Username</h2>
        <p className={styles.muted}>Current username: <strong>@{profile.data?.username ?? "…"}</strong></p>
        {policy.data && !canChange ? <p className={styles.muted}>You can change your username again {policy.data.nextChangeAvailableAt ? `on ${new Date(policy.data.nextChangeAvailableAt).toLocaleDateString()}` : "later"}.</p> : null}
        <TextField label="New username" placeholder="e.g. temi.homes" value={username} disabled={!canChange} autoComplete="off" onChange={(event) => setUsername(event.target.value)} hint={availability.message ?? undefined} error={changeUsername.isError ? readErrorMessageForDisplay(changeUsername.error) || "Couldn't change your username. Try again." : undefined} />
        <ul className={styles.linkList}>{[...POLICY_NOTES, ...(policy.data?.rules ?? [])].map((note) => <li key={note} className={styles.muted}>{note}</li>)}</ul>
        <Button type="submit" disabled={!canChange || !availability.isAvailable} busy={changeUsername.isPending}>Save username</Button>
      </form>
      <section className={styles.block} aria-labelledby="contact-heading">
        <h2 id="contact-heading" className={styles.blockHeading}>Contact</h2>
        <p><IconLabel name="envelope24" size={18}>{settings.data?.email ?? "…"}</IconLabel></p>
        <Link href="/verify-email" className={styles.muted}>Verify your email</Link>
        <p><IconLabel name="phone24" size={18}>{settings.data?.phone ?? "No phone number added"}</IconLabel></p>
      </section>
      <section className={styles.block} aria-labelledby="deactivate-heading">
        <h2 id="deactivate-heading" className={styles.blockHeading}>Deactivate</h2>
        <p className={styles.muted}>Your profile and store will be hidden until you log in again. To delete your account for good, use Privacy &amp; Data.</p>
        <Button variant="danger" busy={deactivate.isPending} onClick={() => void confirmDeactivate()}>Deactivate account</Button>
      </section>
    </div>
  );
}
