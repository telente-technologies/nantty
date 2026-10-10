import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { PasswordRulesChecklist, passwordMeetsEveryRule } from "@/components/settings/passwordRulesChecklist";
import { SettingsPage } from "@/components/settings/settingsPage";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { usersService } from "@/services/account/users.service";

export function ChangePasswordScreen({ navigation }: MainScreenProps<"ChangePassword">) {
  const { colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const changePassword = useMutation({
    mutationFn: () => usersService.changeMyPassword(currentPassword, newPassword),
    onSuccess: () => navigation.goBack(),
  });

  const confirmationMismatch = confirmation.length > 0 && confirmation !== newPassword;
  const canSave = currentPassword.length > 0 && passwordMeetsEveryRule(newPassword) && confirmation === newPassword;

  return (
    <SettingsPage title="Password" gap={24}>
      <View style={styles.fields}>
        <TextField label="Current password" placeholder="Enter current password" password value={currentPassword} onChangeText={setCurrentPassword} autoComplete="current-password" textContentType="password" />
        <TextField label="New password" placeholder="Enter new password" password value={newPassword} onChangeText={setNewPassword} autoComplete="new-password" textContentType="newPassword" />
      </View>
      <PasswordRulesChecklist password={newPassword} />
      <TextField
        label="Confirm new password"
        placeholder="Enter new password again"
        password
        value={confirmation}
        onChangeText={setConfirmation}
        invalid={confirmationMismatch}
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {confirmationMismatch || changePassword.isError ? (
        <Text size={12} lineHeight={14.4} color={colors.error}>
          {confirmationMismatch ? "Passwords don't match" : changePassword.error?.message}
        </Text>
      ) : null}
      <Button title="Save" disabled={!canSave} loading={changePassword.isPending} onPress={() => changePassword.mutate()} />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ fields: { gap: 24 } });
