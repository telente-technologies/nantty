"use client";

import { EmptyState } from "@zudomart/web-kit";

import { Button } from "@/components/ui/button";

import { useAuthPromptStore } from "./authPrompt.store";

interface SignInRequiredStateProps {
  readonly title?: string;
  readonly description?: string;
}

export function SignInRequiredState({ title = "Sign in to see this", description = "This part of Zudomart is for members. Sign in or create a free account to continue." }: SignInRequiredStateProps) {
  const openAuthPrompt = useAuthPromptStore((state) => state.openAuthPrompt);
  return <EmptyState title={title} description={description} action={<Button onClick={() => openAuthPrompt(description)}>Sign in</Button>} />;
}
