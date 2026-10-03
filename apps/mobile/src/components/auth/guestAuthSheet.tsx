import { StyleSheet, View } from "react-native";

import { Apple24Icon, Google24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { useSocialSignIn } from "@/hooks/useSocialSignIn.hook";
import { usePendingAuthIntentStore } from "@/store/pendingAuthIntent.store";
import { makeThemedStyles } from "@/theme";
import { openAuthFlowThenReturn } from "@/utils/requireAuth.util";

export function GuestAuthSheet() {
  const styles = useStyles();
  const reason = usePendingAuthIntentStore((s) => s.signInPromptReason);
  const { isAppleSignInAvailable, providerSigningIn, failureMessage, signInWithProvider } = useSocialSignIn();

  const dismissAndForgetAction = () => {
    const { closeSignInPrompt, discardPendingIntent } = usePendingAuthIntentStore.getState();
    closeSignInPrompt();
    discardPendingIntent();
  };

  return (
    <BottomSheet
      visible={reason !== null}
      onClose={dismissAndForgetAction}
      title={`Sign in to ${reason ?? "continue"}`}
      subtitle="Create a free account or sign in. We'll bring you back here and finish what you started."
    >
      <View style={styles.body}>
        {isAppleSignInAvailable ? (
          <Button variant="outline" title="Continue with Apple" icon={<Apple24Icon />} loading={providerSigningIn === "apple"} onPress={() => signInWithProvider("apple")} />
        ) : null}
        <Button variant="outline" title="Continue with Google" icon={<Google24Icon />} loading={providerSigningIn === "google"} onPress={() => signInWithProvider("google")} />
        <Button title="Sign in" onPress={() => openAuthFlowThenReturn("login")} />
        <Button variant="subtle" title="Create account" onPress={() => openAuthFlowThenReturn("signup")} />
        {failureMessage ? (
          <Text size={12} style={styles.failure} align="center">
            {failureMessage}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 },
  failure: { color: colors.error },
}));
