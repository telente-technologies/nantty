import type { ReactNode } from "react";

import { authOnlyRouteSignInPhrases } from "@/config/guestAccess.config";
import { useAuthStore } from "@/store/auth.store";

import { GuestProfileCard } from "./guestProfileCard";
import { SignInRequiredScreen } from "./signInRequiredScreen";

export function GuestGate({ routeName, children }: { routeName: string; children: ReactNode }) {
  const isSignedIn = useAuthStore((s) => s.status === "signedIn");
  if (isSignedIn) return <>{children}</>;
  if (routeName === "Me") return <GuestProfileCard />;
  const phrase = authOnlyRouteSignInPhrases[routeName];
  return phrase ? <SignInRequiredScreen phrase={phrase} /> : <>{children}</>;
}

export const guestGateScreenLayout = ({ route, children }: { route: { name: string }; children: ReactNode }) => (
  <GuestGate routeName={route.name}>{children}</GuestGate>
);
