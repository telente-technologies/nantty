import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Pressable, StyleSheet, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useAuthStore } from "@/store/auth.store";
import { useChatLockStore } from "@/store/chatLock.store";
import { authenticateWithBiometrics, isValidPasscodeFormat, removeChatPasscodeAndPreferences, verifyChatPasscode } from "@/utils/chatPasscode.util";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

export function ChatLockGate({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const { isLoaded, isLocked, biometricsEnabled, loadFromDevice, unlock, lockIfBackgroundedTooLong } = useChatLockStore();
  const clearSessionAndSignOut = useAuthStore((state) => state.clearSessionAndSignOut);
  const [passcode, setPasscode] = useState("");
  const [hasWrongPasscode, setHasWrongPasscode] = useState(false);
  const backgroundedAtMs = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoaded) loadFromDevice().catch(() => undefined);
  }, [isLoaded, loadFromDevice]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") backgroundedAtMs.current ??= Date.now();
      else if (backgroundedAtMs.current !== null) {
        lockIfBackgroundedTooLong(backgroundedAtMs.current);
        backgroundedAtMs.current = null;
      }
    });
    return () => subscription.remove();
  }, [lockIfBackgroundedTooLong]);

  const unlockWithBiometrics = async () => {
    if (await authenticateWithBiometrics("Unlock your chats")) unlock();
  };

  useEffect(() => {
    if (isLocked && biometricsEnabled) unlockWithBiometrics().catch(() => undefined);
  }, [isLocked, biometricsEnabled]);

  const submitPasscode = async (candidate: string) => {
    if (!isValidPasscodeFormat(candidate)) return;
    if (await verifyChatPasscode(candidate)) {
      setPasscode("");
      setHasWrongPasscode(false);
      unlock();
    } else setHasWrongPasscode(true);
  };

  const forgotPasscode = () =>
    showAlertWithButtons("Forgot passcode?", "To reset your chat passcode you need to log in again. The passcode only exists on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          removeChatPasscodeAndPreferences().finally(() => clearSessionAndSignOut());
        },
      },
    ], { intent: "lock" });

  if (!isLoaded) return null;
  if (!isLocked) return <>{children}</>;
  return (
    <View style={styles.root} accessibilityViewIsModal>
      <View style={styles.centered}>
        <Text size={20} weight={600} lineHeight={24} align="center">Chats are locked</Text>
        <Text size={13} lineHeight={18} color={colors.textMuted} align="center">Enter your 4 to 6 digit chat passcode</Text>
        <TextInput
          accessibilityLabel="Chat passcode"
          value={passcode}
          onChangeText={(value) => {
            const digits = value.replace(/\D/g, "").slice(0, 6);
            setPasscode(digits);
            setHasWrongPasscode(false);
          }}
          onSubmitEditing={() => submitPasscode(passcode)}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          autoFocus
          style={[styles.input, hasWrongPasscode && styles.inputInvalid]}
        />
        {hasWrongPasscode ? <Text size={12} lineHeight={16} color={colors.error} align="center">Wrong passcode, try again</Text> : null}
        <Button title="Unlock" onPress={() => submitPasscode(passcode)} disabled={!isValidPasscodeFormat(passcode)} />
        {biometricsEnabled ? <Button title="Use biometrics" variant="outline" onPress={unlockWithBiometrics} /> : null}
        <Pressable accessibilityRole="button" onPress={forgotPasscode} hitSlop={10}>
          <Text size={13} weight={500} lineHeight={16} color={colors.primary} align="center">Forgot passcode?</Text>
        </Pressable>
      </View>
      <KeyboardSpacer restingHeight={0} offset={tabBarHeight} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, textAlign: "center", fontSize: 24, letterSpacing: 8 },
  inputInvalid: { borderColor: colors.error },
}));
