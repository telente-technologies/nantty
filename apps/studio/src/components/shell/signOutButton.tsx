"use client";

import { useRouter } from "next/navigation";

import { sendRequestToStudioServer } from "@/services/clientApi.service";
import { useAuthStore } from "@/store/auth.store";

import styles from "./studioShell.module.css";

export function SignOutButton() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSessionAndSignOut);

  async function signOut() {
    await sendRequestToStudioServer<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" className={styles.signOut} onClick={() => void signOut()}>
      Sign out
    </button>
  );
}
