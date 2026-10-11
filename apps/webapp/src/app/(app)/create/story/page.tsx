"use client";

import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { CreateModeTabs } from "@/components/create/createModeTabs";
import { StoryComposer } from "@/components/create/storyComposer";
import { useSession } from "@/components/providers/sessionProvider";

export default function NewStoryPage() {
  const { viewer } = useSession();
  if (!viewer) return <SignInRequiredState title="Sign in to post" description="Sign in to create posts, clips and lives." />;
  return (
    <>
      <CreateModeTabs active="story" />
      <StoryComposer />
    </>
  );
}
