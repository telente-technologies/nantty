import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { profileQueryKeys, useMyProfileQuery } from "@/components/profile/profileQueries.hook";
import { SettingsPage } from "@/components/settings/settingsPage";
import { useUsernameAvailability } from "@/components/settings/usernameAvailability.hook";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { ApiError } from "@/errors/api.error";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { usersService } from "@/services/users.service";
import { useAuthStore } from "@/store/auth.store";

const POLICY_NOTES = [
  "Some usernames are reserved for Zudomart and can't be used.",
  "Zudomart may withhold or reclaim a username that violates our policies, impersonates someone or is needed for legal reasons.",
];

export function SettingsUsernameScreen({ navigation }: MainScreenProps<"SettingsUsername">) {
  const queryClient = useQueryClient();
  const updateSignedInUser = useAuthStore((state) => state.updateSignedInUser);
  const { data: profile } = useMyProfileQuery();
  const policy = useQuery({ queryKey: ["users", "me", "username-policy"], queryFn: usersService.fetchMyUsernamePolicy });
  const [username, setUsername] = useState("");
  const { isAvailable, message } = useUsernameAvailability(username, profile?.username);
  const changeUsername = useMutation({
    mutationFn: () => usersService.changeMyUsername(username.trim()),
    onSuccess: (updated) => {
      updateSignedInUser(updated);
      queryClient.setQueryData(profileQueryKeys.myProfile, updated);
      queryClient.invalidateQueries({ queryKey: ["users", "me", "username-policy"] });
      navigation.goBack();
    },
  });
  const canChange = policy.data?.canChangeNow ?? false;
  const errorText = changeUsername.error instanceof ApiError ? changeUsername.error.message : changeUsername.error ? "Couldn't change your username. Try again." : null;

  return (
    <SettingsPage title="Username" gap={20} contentTopSpacing={24}>
      <View style={styles.card}>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>Current username</Text>
        <Text size={16} weight={600} lineHeight={19.2}>@{profile?.username ?? ""}</Text>
        {policy.data ? (
          <Text size={12} lineHeight={16.8} color={canChange ? colors.success : colors.caution}>
            {canChange
              ? `You can change it now · ${policy.data.changesRemainingThisYear} change${policy.data.changesRemainingThisYear === 1 ? "" : "s"} left this year`
              : policy.data.nextChangeAvailableAt
                ? `Next change available ${formatFriendlyDate(policy.data.nextChangeAvailableAt)}`
                : "You've used all your username changes for this year"}
          </Text>
        ) : null}
      </View>
      <TextField
        label="New username"
        placeholder="e.g. temi.homes"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        editable={canChange}
        value={username}
        onChangeText={(value) => setUsername(value.replace(/\s/g, "").toLowerCase())}
      />
      {message ? <Text size={12} lineHeight={16.8} color={isAvailable ? colors.success : colors.textMuted}>{message}</Text> : null}
      {errorText ? <Text size={12} lineHeight={16.8} color={colors.error} accessibilityRole="alert">{errorText}</Text> : null}
      <Button title="Save username" disabled={!canChange || !isAvailable} loading={changeUsername.isPending} onPress={() => changeUsername.mutate()} />
      <View style={styles.card}>
        {(policy.data?.rules ?? []).map((rule) => (
          <Text key={rule} size={12} lineHeight={16.8} color={colors.textMuted}>• {rule}</Text>
        ))}
        {POLICY_NOTES.map((note) => (
          <Text key={note} size={12} lineHeight={16.8} color={colors.textMuted}>• {note}</Text>
        ))}
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 6 } });
