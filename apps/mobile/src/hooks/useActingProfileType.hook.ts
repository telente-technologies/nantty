import { useActingProfileStore } from "@/store/actingProfile.store";
import { profileTypeForKind } from "@/utils/verificationProfile.util";

export const useActingProfileType = () => {
  const kind = useActingProfileStore((state) => state.actingProfile?.kind ?? null);
  return { kind, type: profileTypeForKind(kind) };
};
