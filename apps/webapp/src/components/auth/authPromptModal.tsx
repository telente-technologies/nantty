"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { OfficialStoreBadges } from "@zudomart/web-kit";

import { useSession } from "@/components/providers/sessionProvider";
import { storeLinks } from "@/config/brandContact.config";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { WebappRequestError, rememberCsrfTokenForRequests, sendRequestToWebappServer } from "@/services/clientApi.service";
import { useAuthStore } from "@/store/auth.store";
import type { User } from "@/types";

import { useAuthPromptStore } from "./authPrompt.store";
import styles from "./authPromptModal.module.css";

function useReplayPendingActionAfterSignIn() {
  const { viewer, csrfToken } = useSession();
  const isWaitingToReplay = useAuthPromptStore((state) => state.isWaitingToReplay);
  useEffect(() => {
    if (!viewer || !isWaitingToReplay) return;
    rememberCsrfTokenForRequests(csrfToken);
    useAuthStore.getState().setViewerFromSession(viewer);
    useAuthPromptStore.getState().takePendingActionForReplay()?.();
  }, [viewer, csrfToken, isWaitingToReplay]);
}

export function AuthPromptModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isOpen, reason, closeAuthPrompt, markSignedInAndWaitToReplay } = useAuthPromptStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  useReplayPendingActionAfterSignIn();

  const query = searchParams.toString();
  const nextPath = encodeURIComponent(`${pathname}${query ? `?${query}` : ""}`);

  async function signInWithoutLeavingThePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identifier.trim() || !password) return;
    setIsBusy(true);
    setFormError(null);
    try {
      const signedIn = await sendRequestToWebappServer<{ user: User; csrfToken?: string }>("/auth/login", { method: "POST", body: { identifier: identifier.trim(), password } });
      if (signedIn.csrfToken) rememberCsrfTokenForRequests(signedIn.csrfToken);
      setPassword("");
      markSignedInAndWaitToReplay();
      router.refresh();
    } catch (error) {
      setFormError(error instanceof WebappRequestError ? error.message : "Couldn't sign in. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={closeAuthPrompt} title="Sign in to Zudomart" description={reason ?? undefined} layout="sheet" intent="signIn">
      <form className={styles.form} onSubmit={signInWithoutLeavingThePage} noValidate>
        {formError ? (
          <p className={styles.error} role="alert">
            {formError}
          </p>
        ) : null}
        <TextField label="Email or username" name="identifier" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <Button type="submit" size="lg" fullWidth busy={isBusy} disabled={!identifier.trim() || !password}>
          Sign in
        </Button>
      </form>
      <p className={styles.footer}>
        New here?{" "}
        <Link href={`/signup?next=${nextPath}`} onClick={closeAuthPrompt}>
          Create an account
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href={`/login?next=${nextPath}`} onClick={closeAuthPrompt}>
          More sign-in options
        </Link>
      </p>
      <div className={styles.appPrompt}>
        <p className={styles.appPromptText}>Shop, sell and go live on the Zudomart app.</p>
        <OfficialStoreBadges links={storeLinks} align="center" />
      </div>
    </Dialog>
  );
}
