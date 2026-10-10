import { useMutation, useQueryClient } from "@tanstack/react-query";

import { celebrationsQueryKey, useViewerCelebrationsQuery } from "@/hooks/useSurfaceCelebration.hook";
import { celebrationsService } from "@/services/social/celebrations.service";

import { ConsentToggleRow } from "./consentToggleRow";

export function BirthdayBalloonsToggle() {
  const queryClient = useQueryClient();
  const query = useViewerCelebrationsQuery(true);
  const update = useMutation({
    mutationFn: (birthdayBalloonsVisible: boolean) => celebrationsService.updateSettings({ birthdayBalloonsVisible }),
    onSuccess: (next) => queryClient.setQueryData(celebrationsQueryKey, next),
  });
  if (!query.data) return null;
  return (
    <ConsentToggleRow
      label="Birthday balloons"
      description="Show balloons on your profile to visitors on your birthday. Your age and date of birth are never shown to others."
      enabled={update.variables ?? query.data.birthdayBalloonsVisible}
      onChange={(enabled) => update.mutate(enabled)}
    />
  );
}
