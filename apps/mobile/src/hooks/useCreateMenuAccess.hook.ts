import { useMyProfileQuery } from "@/components/profile/profileQueries.hook";
import { useAuthStore } from "@/store/auth.store";
import { listCreateModesForViewer } from "@/utils/createMenu.util";

import { useCreatorStatus } from "./useCreatorStatus.hook";

export function useCreateMenuAccess() {
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const myProfile = useMyProfileQuery();
  const { isApprovedCreator, isCreatorStatusLoading } = useCreatorStatus();
  const isApprovedSeller = isSignedIn && myProfile.data?.isSeller === true;
  const isApprovedCreatorViewer = isSignedIn && isApprovedCreator;
  return {
    isApprovedSeller,
    isApprovedCreator: isApprovedCreatorViewer,
    isSellerStatusLoading: isSignedIn && myProfile.isPending,
    isCreatorStatusLoading: isSignedIn && isCreatorStatusLoading,
    availableModes: listCreateModesForViewer(isApprovedSeller, isApprovedCreatorViewer),
  };
}
