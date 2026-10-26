import { useEffect, useState } from "react";

import { SettingToggleRow } from "@/components/chatSafety/settingToggleRow";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { useChatLockStore } from "@/store/chatLock.store";
import {
  AUTO_LOCK_OPTIONS_SECONDS,
  areBiometricsAvailable,
  authenticateWithBiometrics,
  describeAutoLockOption,
  isValidPasscodeFormat,
  saveChatPasscode,
  verifyChatPasscode,
} from "@/utils/chatPasscode.util";

type PasscodeMode = "overview" | "set" | "change" | "remove";

const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, 6);

export function ChatPasscodeScreen() {
  const { colors } = useTheme();
  const { isPasscodeSet, biometricsEnabled, autoLockSeconds, refreshPasscodeFlag, updatePreferences, removePasscode, unlock } = useChatLockStore();
  const [mode, setMode] = useState<PasscodeMode>("overview");
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);

  useEffect(() => {
    areBiometricsAvailable().then(setCanUseBiometrics).catch(() => undefined);
  }, []);

  const returnToOverview = () => {
    setMode("overview");
    setCurrentPasscode("");
    setNewPasscode("");
    setConfirmPasscode("");
    setErrorMessage(null);
  };

  const submit = async () => {
    if (mode !== "set" && !(await verifyChatPasscode(currentPasscode))) return setErrorMessage("Your current passcode is wrong");
    if (mode === "remove") {
      await removePasscode();
      return returnToOverview();
    }
    if (!isValidPasscodeFormat(newPasscode)) return setErrorMessage("Use 4 to 6 digits");
    if (newPasscode !== confirmPasscode) return setErrorMessage("The passcodes don't match");
    await saveChatPasscode(newPasscode);
    await refreshPasscodeFlag();
    unlock();
    returnToOverview();
  };

  const toggleBiometrics = async (enabled: boolean) => {
    if (enabled && !(await authenticateWithBiometrics("Turn on biometric unlock for chats"))) return;
    await updatePreferences({ biometricsEnabled: enabled });
  };

  if (mode !== "overview") {
    return (
      <SettingsPage title={mode === "remove" ? "Remove passcode" : mode === "change" ? "Change passcode" : "Set passcode"} contentTopSpacing={24} gap={16}>
        {mode !== "set" ? <TextField label="Current passcode" value={currentPasscode} onChangeText={(value) => setCurrentPasscode(digitsOnly(value))} keyboardType="number-pad" secureTextEntry maxLength={6} /> : null}
        {mode !== "remove" ? (
          <>
            <TextField label="New passcode (4 to 6 digits)" value={newPasscode} onChangeText={(value) => setNewPasscode(digitsOnly(value))} keyboardType="number-pad" secureTextEntry maxLength={6} />
            <TextField label="Confirm passcode" value={confirmPasscode} onChangeText={(value) => setConfirmPasscode(digitsOnly(value))} keyboardType="number-pad" secureTextEntry maxLength={6} />
          </>
        ) : null}
        {errorMessage ? <Text size={12} lineHeight={16} color={colors.error}>{errorMessage}</Text> : null}
        <Button title={mode === "remove" ? "Remove passcode" : "Save passcode"} variant={mode === "remove" ? "danger" : "primary"} onPress={() => submit().catch(() => setErrorMessage("We couldn't save your passcode. Try again."))} />
        <Button title="Cancel" variant="outline" onPress={returnToOverview} />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title="Chat passcode" contentTopSpacing={24} gap={24}>
      <Text size={13} lineHeight={18} color={colors.textMuted}>
        The passcode locks your chats on this device only. It is never sent to Nantty. If you forget it, you'll need to log in again to reset it.
      </Text>
      {isPasscodeSet ? (
        <>
          <SettingsGroup>
            <SettingsRow label="Change passcode" onPress={() => setMode("change")} />
            <SettingsRow label="Remove passcode" labelColor={colors.error} trailing="none" onPress={() => setMode("remove")} />
          </SettingsGroup>
          {canUseBiometrics ? (
            <SettingsGroup>
              <SettingToggleRow label="Unlock with biometrics" value={biometricsEnabled} onValueChange={(value) => toggleBiometrics(value).catch(() => undefined)} />
            </SettingsGroup>
          ) : null}
          <SettingsGroup>
            <Text size={13} weight={600} lineHeight={18} style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>Auto-lock</Text>
            {AUTO_LOCK_OPTIONS_SECONDS.map((seconds) => (
              <SettingsRow key={seconds} label={describeAutoLockOption(seconds)} trailing={autoLockSeconds === seconds ? { text: "Selected" } : "none"} onPress={() => updatePreferences({ autoLockSeconds: seconds })} />
            ))}
          </SettingsGroup>
        </>
      ) : (
        <Button title="Set a passcode" onPress={() => setMode("set")} />
      )}
    </SettingsPage>
  );
}
