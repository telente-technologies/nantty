"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { SelectField } from "@/components/ui/formFields";
import { suspensionDurationOptions } from "@/constants/trustOptions.constant";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { decideLiveIncident, endLiveAndSuspendHost } from "@/services/liveIncidentsApi.service";
import type { LiveIncidentAction, LiveIncidentDetail } from "@/types/liveIncident.type";

interface LiveIncidentActionPresentation {
  readonly title: string;
  readonly confirmLabel: string;
  readonly isDestructive: boolean;
  readonly requiresStepUp: boolean;
  readonly consequences: (incident: LiveIncidentDetail) => string[];
}

const hostName = (incident: LiveIncidentDetail) => (incident.host.username ? `@${incident.host.username}` : "The host");

export const liveIncidentActionPresentations: Record<LiveIncidentAction, LiveIncidentActionPresentation> = {
  keep_live: {
    title: "Keep this live running", confirmLabel: "Keep live", isDestructive: false, requiresStepUp: false,
    consequences: (incident) => [incident.holdActive ? "The pause is lifted and viewers see the stream again." : "The live keeps running.", "No strike is added.", "The incident closes."],
  },
  keep_paused: {
    title: "Keep this live paused", confirmLabel: "Keep paused", isDestructive: true, requiresStepUp: false,
    consequences: (incident) => ["Viewers keep seeing the paused screen.", `${hostName(incident)} gets a strike and can appeal.`, "You can release it later from this queue."],
  },
  end_live: {
    title: "End this live", confirmLabel: "End live", isDestructive: true, requiresStepUp: false,
    consequences: (incident) => ["The stream stops for everyone and the host sees why.", `${hostName(incident)} gets a strike and can appeal.`],
  },
  end_and_suspend: {
    title: "End the live and suspend the host", confirmLabel: "End and suspend", isDestructive: true, requiresStepUp: true,
    consequences: (incident) => ["The stream stops for everyone.", `${hostName(incident)} is signed out and can't post, sell, go live or withdraw during the suspension.`, "A strike is added. Open orders keep running through escrow."],
  },
};

export function LiveIncidentActionDialog({ incident, action, onClose, onCompleted }: { readonly incident: LiveIncidentDetail; readonly action: LiveIncidentAction | null; readonly onClose: () => void; readonly onCompleted: (updated: LiveIncidentDetail, action: LiveIncidentAction) => void }) {
  const [suspensionDays, setSuspensionDays] = useState("7");
  const mutation = useAdminMutation(async (input: { action: LiveIncidentAction; reason: string }) =>
    input.action === "end_and_suspend" ? endLiveAndSuspendHost(incident.id, Number(suspensionDays), input.reason) : decideLiveIncident(incident.id, input.action, input.reason),
  );
  if (!action) return null;
  const presentation = liveIncidentActionPresentations[action];

  async function confirmAction(reason: string) {
    if (!action) return;
    const updated = await mutation.run({ action, reason });
    if (updated) onCompleted(updated, action);
  }

  return (
    <ConfirmActionDialog intent="live"
      isOpen
      title={presentation.title}
      consequences={presentation.consequences(incident)}
      confirmLabel={presentation.confirmLabel}
      tone={presentation.isDestructive ? "danger" : "default"}
      requiresStepUp={presentation.requiresStepUp}
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirmAction}
      onClose={() => {
        mutation.clearError();
        onClose();
      }}
    >
      {action === "end_and_suspend" ? <SelectField label="Suspension length" value={suspensionDays} onChange={(event) => setSuspensionDays(event.target.value)} options={suspensionDurationOptions} /> : null}
    </ConfirmActionDialog>
  );
}
