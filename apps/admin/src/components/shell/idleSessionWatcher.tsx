"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAdminSession } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modalDialog";
import { sendRequestToAdminConsoleServer, subscribeToAdminActivity } from "@/services/adminApiClient.service";
import { formatDurationFromSeconds } from "@/utils/formatting.util";

const warningWindowInSeconds = 120;

function signOutBecauseOf(reason: "idle" | "expired"): void {
  window.location.assign(`/bff/auth/signed-out?reason=${reason}&next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
}

export function IdleSessionWatcher() {
  const { lastActivityAtEpochSeconds, idleTimeoutSeconds, sessionStartedAtEpochSeconds, absoluteTimeoutSeconds } = useAdminSession();
  const lastActivityRef = useRef(lastActivityAtEpochSeconds * 1000);
  const [secondsLeft, setSecondsLeft] = useState(idleTimeoutSeconds);
  const [isExtending, setIsExtending] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, [pathname]);

  useEffect(() => {
    lastActivityRef.current = Math.max(lastActivityRef.current, lastActivityAtEpochSeconds * 1000);
  }, [lastActivityAtEpochSeconds]);

  useEffect(() => subscribeToAdminActivity(() => (lastActivityRef.current = Date.now())), []);

  useEffect(() => {
    const absoluteEndEpochMs = (sessionStartedAtEpochSeconds + absoluteTimeoutSeconds) * 1000;
    const timer = window.setInterval(() => {
      if (Date.now() >= absoluteEndEpochMs) return signOutBecauseOf("expired");
      const remaining = Math.round(idleTimeoutSeconds - (Date.now() - lastActivityRef.current) / 1000);
      setSecondsLeft(remaining);
      if (remaining <= 0) signOutBecauseOf("idle");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [idleTimeoutSeconds, sessionStartedAtEpochSeconds, absoluteTimeoutSeconds]);

  async function staySignedIn() {
    setIsExtending(true);
    try {
      await sendRequestToAdminConsoleServer("/bff/auth/keep-alive", { method: "POST", promptForStepUp: false });
      lastActivityRef.current = Date.now();
      setSecondsLeft(idleTimeoutSeconds);
    } catch {
      signOutBecauseOf("idle");
    } finally {
      setIsExtending(false);
    }
  }

  return (
    <ModalDialog intent="lock"
      isOpen={secondsLeft <= warningWindowInSeconds && secondsLeft > 0}
      title="You're about to be signed out"
      description={`No activity for a while. For safety, this session ends in ${formatDurationFromSeconds(secondsLeft)}.`}
      onClose={staySignedIn}
      width="narrow"
      tone="secure"
      footer={
        <>
          <Button variant="ghost" onClick={() => signOutBecauseOf("idle")}>
            Sign out now
          </Button>
          <Button variant="primary" onClick={staySignedIn} isBusy={isExtending}>
            Stay signed in
          </Button>
        </>
      }
    >
      <p>Unsaved changes on this page are kept only while you stay signed in.</p>
    </ModalDialog>
  );
}
