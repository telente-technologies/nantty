"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { ClipComposer } from "@/components/create/clipComposer";
import { CreateModeTabs } from "@/components/create/createModeTabs";
import { useSession } from "@/components/providers/sessionProvider";
import { readClipVideoReplyTarget } from "@/utils/clipVideoReply.util";

export default function NewClipPage() {
  return (
    <Suspense>
      <NewClipComposerWithSound />
    </Suspense>
  );
}

function NewClipComposerWithSound() {
  const { viewer } = useSession();
  const searchParams = useSearchParams();
  const soundId = searchParams.get("soundId");
  const replyToComment = readClipVideoReplyTarget(searchParams);
  if (!viewer) return <SignInRequiredState title="Sign in to post" description="Sign in to create posts, clips and lives." />;
  return (
    <>
      <CreateModeTabs active="clip" />
      <ClipComposer initialSoundId={soundId && /^[A-Za-z0-9_-]{1,64}$/.test(soundId) ? soundId : null} replyToComment={replyToComment} />
    </>
  );
}
