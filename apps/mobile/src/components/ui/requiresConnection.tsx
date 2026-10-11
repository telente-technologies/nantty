import type { ReactElement, ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useOfflineStore } from "@/store/offline.store";
import { useTheme } from "@/theme";

import { ErrorScreen } from "./errorState";

export const onlineOnlyRouteNames: ReadonlySet<string> = new Set(["Live", "Checkout", "Payment", "AddMoney", "Withdraw", "PayoutSetup", "IdentityVerification", "VerificationApply"]);

export function RequiresConnection({ children }: { readonly children: ReactNode }) {
  const { colors } = useTheme();
  const isOnline = useOfflineStore((state) => state.isOnline);
  return (
    <View style={styles.root}>
      {children}
      {isOnline ? null : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} testID="offline-screen">
          <ErrorScreen kind="offline" onRetry={noop} description="This needs an internet connection. Check your data or Wi-Fi, and we'll pick up right where you left off." />
        </View>
      )}
    </View>
  );
}

export function withConnectionRequirement<LayoutProps extends { route: { name: string }; children: ReactNode }>(layout: (props: LayoutProps) => ReactElement) {
  return function ScreenLayoutRequiringConnection(props: LayoutProps): ReactElement {
    if (!onlineOnlyRouteNames.has(props.route.name)) return layout(props);
    return layout({ ...props, children: <RequiresConnection>{props.children}</RequiresConnection> });
  };
}

const noop = () => undefined;
const styles = StyleSheet.create({ root: { flex: 1 } });
