import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notificationsService } from "@/services/account/notifications.service";
import type { NotificationPreference } from "@/types/notificationPreference.type";

import { ConsentToggleRow } from "./consentToggleRow";

const queryKey = ["notificationPreferences"] as const;

export function MilestonesPreferenceRows() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey, queryFn: notificationsService.listPreferences });
  const update = useMutation({
    mutationFn: (change: { push?: boolean; email?: boolean }) => notificationsService.updatePreference("milestones", change),
    onSuccess: (next) =>
      queryClient.setQueryData<NotificationPreference[]>(queryKey, (rows) => (rows ?? []).map((row) => (row.category === next.category ? next : row))),
  });
  const row = query.data?.find((item) => item.category === "milestones");
  if (!row) return null;
  return (
    <>
      <ConsentToggleRow
        label="Milestones: push"
        description="Birthdays and Nanttyversaries, like your account anniversary."
        enabled={update.variables?.push ?? row.push}
        onChange={(push) => update.mutate({ push })}
      />
      <ConsentToggleRow
        label="Milestones: email"
        description="A celebration email on your Nanttyversary."
        enabled={update.variables?.email ?? row.email}
        onChange={(email) => update.mutate({ email })}
      />
    </>
  );
}
