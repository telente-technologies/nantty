"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { runCopyrightAudioMatch } from "@/services/copyrightPolicyApi.service";
import type { CopyrightClaimDetail } from "@/types/copyright.type";

export function AudioMatchRunButton({ claim, onClaimUpdated }: { readonly claim: CopyrightClaimDetail; readonly onClaimUpdated: (updated: CopyrightClaimDetail) => void }) {
  const { showToast } = useToast();
  const mutation = useAdminMutation(() => runCopyrightAudioMatch(claim.id));
  async function run() {
    const updated = await mutation.run(undefined);
    if (!updated) {
      showToast(mutation.errorMessage ?? "Audio match is not available for this claim.");
      return;
    }
    onClaimUpdated(updated);
    showToast("Audio match updated. Scores are advice only.");
  }
  return <Button size="small" variant="secondary" onClick={() => void run()} disabled={mutation.isRunning}>Run audio match</Button>;
}
