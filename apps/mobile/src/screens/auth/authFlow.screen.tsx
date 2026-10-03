import { useEffect } from "react";

import { AuthNavigator } from "@/navigation/auth.navigator";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { usePendingAuthIntentStore } from "@/store/pendingAuthIntent.store";
import { isViewerSignedIn } from "@/utils/requireAuth.util";

export function AuthFlowScreen({ route }: MainScreenProps<"AuthFlow">) {
  useEffect(
    () => () => {
      if (!isViewerSignedIn()) usePendingAuthIntentStore.getState().discardPendingIntent();
    },
    [],
  );
  return <AuthNavigator embeddedMode={route.params?.mode ?? "signup"} />;
}
