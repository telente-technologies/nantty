import { useAuthStore } from "@/store/auth.store";
import { useSurfaceCelebration } from "@/hooks/useSurfaceCelebration.hook";

import { CelebrationOverlay } from "./celebrationOverlay";

export function CelebrationHost() {
  const signedIn = useAuthStore((state) => state.status === "signedIn");
  const { celebration, dismiss } = useSurfaceCelebration("app", signedIn);
  return celebration ? <CelebrationOverlay celebration={celebration} onDismiss={dismiss} /> : null;
}
