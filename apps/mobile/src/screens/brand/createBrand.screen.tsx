import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CameraBolt24Icon } from "@/components/icons";
import { pickSquareOrWideImageFromLibrary } from "@/components/profile/pickImage.util";
import { useUsernameAvailability } from "@/components/settings/usernameAvailability.hook";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { brandsService } from "@/services/sellers/brands.service";
import { categoriesService } from "@/services/catalog/categories.service";
import { mediaService } from "@/services/media/media.service";

export function CreateBrandScreen({ navigation }: MainScreenProps<"CreateBrand">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: categoriesService.fetchProductCategories });
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState<{ uri: string; contentType: string } | null>(null);
  const [cover, setCover] = useState<{ uri: string; contentType: string } | null>(null);
  const { isAvailable, message } = useUsernameAvailability(handle);
  const idempotencyKey = useRef(generateIdempotencyKey());

  const createBrand = useMutation({
    mutationFn: async () => {
      const logoUrl = logo ? await mediaService.uploadLocalImageAndReturnPublicUrl(logo.uri, logo.contentType, "avatar") : null;
      const coverUrl = cover ? await mediaService.uploadLocalImageAndReturnPublicUrl(cover.uri, cover.contentType, "banner") : null;
      return brandsService.createBrand(
        { name: name.trim(), handle: handle.trim(), logoUrl, coverUrl, categoryId: categoryId!, description: description.trim(), website: website.trim() || null },
        idempotencyKey.current,
      );
    },
    onSuccess: (brand) => {
      queryClient.invalidateQueries({ queryKey: ["users", "me", "profiles"] });
      navigation.replace("BrandProfile", { brandId: brand.id });
    },
  });
  const ready = name.trim().length >= 2 && isAvailable && !!categoryId && description.trim().length >= 20;

  return (
    <Screen>
      <Header title="Create a brand" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text size={13} lineHeight={17.5} color={colors.textMuted}>
          A brand profile represents your business or organisation. Verify it with Gold to open an Official Store.
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose cover image" onPress={async () => setCover((await pickSquareOrWideImageFromLibrary([3, 1])) ?? cover)} style={styles.cover}>
          {cover ? <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <CameraBolt24Icon />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose logo" onPress={async () => setLogo((await pickSquareOrWideImageFromLibrary([1, 1])) ?? logo)} style={styles.logo}>
          {logo ? <Image source={{ uri: logo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <CameraBolt24Icon />
        </Pressable>
        <TextField label="Brand name" placeholder="e.g. Adire House" value={name} onChangeText={setName} maxLength={50} />
        <TextField label="Handle" placeholder="e.g. adirehouse" autoCapitalize="none" autoCorrect={false} value={handle} onChangeText={(value) => setHandle(value.replace(/\s/g, "").toLowerCase())} maxLength={20} />
        {message ? <Text size={12} lineHeight={16.8} color={isAvailable ? colors.success : colors.textMuted}>{message}</Text> : null}
        <Text size={14} lineHeight={16.8}>Category</Text>
        <View style={styles.chips}>
          {(categories.data ?? []).map((category) => (
            <Chip key={category.id} kind="topic" label={category.name} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)} />
          ))}
        </View>
        <TextField label="Description" placeholder="What does your brand make?" value={description} onChangeText={setDescription} multiline maxLength={300} boxStyle={styles.multiline} />
        <TextField label="Website (optional)" placeholder="https://" autoCapitalize="none" keyboardType="url" value={website} onChangeText={setWebsite} />
      </ScrollView>
      <View style={styles.footer}>
        {createBrand.isError ? <Text size={12} color={colors.error} align="center">{createBrand.error.message}</Text> : null}
        <Button title="Create brand" disabled={!ready} loading={createBrand.isPending} onPress={() => createBrand.mutate()} />
      </View>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  cover: { height: 110, borderRadius: 8, backgroundColor: colors.chip, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  logo: { width: 72, height: 72, borderRadius: 8, marginTop: -40, marginLeft: 12, backgroundColor: colors.skeleton, borderWidth: 2, borderColor: colors.surface, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  multiline: { height: 100, alignItems: "flex-start", paddingVertical: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
}));
