import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { BusinessCategoryPicker } from "@/components/profile/businessCategoryPicker";
import { useUsernameAvailability } from "@/components/settings/usernameAvailability.hook";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { brandsService } from "@/services/sellers/brands.service";
import { useActingProfileStore } from "@/store/actingProfile.store";
import type { BusinessCategorySelection } from "@/types/socialGraph.type";
import { describeActionFailure } from "@/errors/errorExperience/describeError";

export function CreateBusinessProfileScreen({ navigation }: MainScreenProps<"CreateBusinessProfile">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const setActingProfile = useActingProfileStore((state) => state.setActingProfile);
  const categories = useQuery({ queryKey: ["business-categories"], queryFn: brandsService.listBusinessCategories });
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [selections, setSelections] = useState<readonly BusinessCategorySelection[]>([]);
  const { isAvailable, message } = useUsernameAvailability(handle);
  const idempotencyKey = useRef(generateIdempotencyKey());

  const createBusinessProfile = useMutation({
    mutationFn: () =>
      brandsService.createBusinessProfile(
        { displayName: displayName.trim(), handle: handle.trim(), description: description.trim(), categories: selections },
        idempotencyKey.current,
      ),
    onSuccess: async (profile) => {
      const switched = await brandsService.switchActingProfile(profile.id);
      setActingProfile(switched);
      queryClient.setQueryData(["users", "me", "acting-profile"], switched);
      queryClient.invalidateQueries({ queryKey: ["users", "me", "profiles"] });
      navigation.goBack();
    },
  });
  const isReady = displayName.trim().length >= 2 && isAvailable && selections.length > 0;

  return (
    <Screen>
      <Header title="Create business profile" />
      {categories.isPending ? (
        <ListSkeleton rows={4} />
      ) : categories.isError ? (
        <ErrorState error={categories.error} message="Couldn't load categories." onRetry={() => categories.refetch()} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text size={13} lineHeight={17.5} color={colors.textMuted}>
              For any organisation: brands, NGOs, media, venues and more. You can open a store later.
            </Text>
            <TextField label="Business name" placeholder="e.g. Lagos Food Bank" value={displayName} onChangeText={setDisplayName} maxLength={50} />
            <TextField label="Handle" placeholder="e.g. lagosfoodbank" autoCapitalize="none" autoCorrect={false} value={handle} onChangeText={(value) => setHandle(value.replace(/\s/g, "").toLowerCase())} maxLength={20} />
            {message ? <Text size={12} lineHeight={16.8} color={isAvailable ? colors.success : colors.textMuted}>{message}</Text> : null}
            <TextField label="About (optional)" placeholder="What does your organisation do?" value={description} onChangeText={setDescription} multiline maxLength={300} boxStyle={styles.multiline} />
            <BusinessCategoryPicker categories={categories.data.data} value={selections} onChange={setSelections} />
          </ScrollView>
          <View style={styles.footer}>
            {createBusinessProfile.isError ? <Text size={12} color={colors.error} align="center">{describeActionFailure(createBusinessProfile.error)}</Text> : null}
            <Button title="Create business profile" disabled={!isReady} loading={createBusinessProfile.isPending} onPress={() => createBusinessProfile.mutate()} />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  multiline: { height: 100, alignItems: "flex-start", paddingVertical: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
});
