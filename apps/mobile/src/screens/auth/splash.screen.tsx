import { useEffect } from "react";

import { BootSplash } from "@/components/brand/bootSplash";
import type { AuthScreenProps } from "@/navigation/navigation.types";

export function SplashScreen({ navigation }: AuthScreenProps<"Splash">) {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace("Onboarding", { mode: "signup" }), 1200);
    return () => clearTimeout(timer);
  }, [navigation]);

  return <BootSplash />;
}
