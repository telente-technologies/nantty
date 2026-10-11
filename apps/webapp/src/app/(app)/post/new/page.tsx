"use client";

import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { CreateModeTabs } from "@/components/create/createModeTabs";
import { PostComposer } from "@/components/create/postComposer";
import { useSession } from "@/components/providers/sessionProvider";

export default function NewPostPage() {
  const { viewer } = useSession();
  if (!viewer) return <SignInRequiredState title="Sign in to post" description="Sign in to create posts, clips and lives." />;
  return (
    <>
      <CreateModeTabs active="post" />
      <PostComposer />
    </>
  );
}
