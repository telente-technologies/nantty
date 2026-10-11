"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { CreateModeTabs } from "@/components/create/createModeTabs";
import { PostComposer } from "@/components/create/postComposer";
import { useSession } from "@/components/providers/sessionProvider";
import { readQuoteParam } from "@/utils/composerDraft.util";

export default function NewPostPage() {
  return (
    <Suspense>
      <NewPostComposerWithQuote />
    </Suspense>
  );
}

function NewPostComposerWithQuote() {
  const { viewer } = useSession();
  const quotePostId = readQuoteParam(useSearchParams().get("quote"));
  if (!viewer) return <SignInRequiredState title={quotePostId ? "Sign in to quote" : "Sign in to post"} description="Sign in to create posts, clips and lives." />;
  return (
    <>
      <CreateModeTabs active="post" />
      <PostComposer key={quotePostId ?? "new"} quotePostId={quotePostId} />
    </>
  );
}
