"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { OfficialStoreBadges } from "@nantty/web-kit";

import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import styles from "@/components/create/composer.module.css";
import { CreateModeTabs } from "@/components/create/createModeTabs";
import { useSession } from "@/components/providers/sessionProvider";
import { Spinner } from "@/components/ui/feedback";
import { storeLinks } from "@/config/brandContact.config";
import { composerService } from "@/services/composer.service";

export default function GoLivePage() {
  const { viewer } = useSession();
  const creatorStatus = useQuery({ queryKey: ["creator", "status", viewer?.id ?? ""], queryFn: composerService.fetchMyCreatorStatus, enabled: viewer !== null, retry: false });
  if (!viewer) return <SignInRequiredState title="Sign in to go live" description="Sign in to create posts, clips and lives." />;
  const isApprovedCreator = creatorStatus.data?.status === "approved";
  return (
    <>
      <CreateModeTabs active="live" />
      <section className={styles.liveGate} aria-labelledby="go-live-title">
        <h1 id="go-live-title" className={styles.title}>Go live</h1>
        {creatorStatus.isLoading ? <Spinner label="Checking your creator status" /> : isApprovedCreator ? (
          <>
            <p>Go live from the Nantty app. Hosting needs your phone&apos;s camera, live gifts and host controls, so it isn&apos;t available on the web yet.</p>
            <p className={styles.hint}>Your followers can watch, chat and send gifts from the web once you&apos;re live.</p>
            <OfficialStoreBadges links={storeLinks} />
            <Link href="/live" className={styles.textButton}>See who&apos;s live now</Link>
          </>
        ) : (
          <>
            <p>Join the Creator Program to go live.</p>
            <p className={styles.hint}>Approved creators can host lives, receive gifts and earn from their audience.</p>
            <Link href="/creator/program" className={styles.textButton}>Learn about the Creator Program</Link>
          </>
        )}
      </section>
    </>
  );
}
