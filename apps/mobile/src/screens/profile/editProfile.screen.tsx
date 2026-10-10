import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { CameraBolt24Icon, SealCheck20Icon } from "@/components/icons";
import { pickSquareOrWideImageFromLibrary, type PickedImage } from "@/components/profile/pickImage.util";
import { useMyProfileQuery, useSaveProfileDetailsMutation } from "@/components/profile/profileQueries.hook";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { fontFamily } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { uploadProfileImageAndReturnMediaId } from "@/services/chat/profileImageUpload.service";

const KEYBOARD_BOTTOM_OFFSET = 24;

export function EditProfileScreen({ navigation }: MainScreenProps<"EditProfile">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { data: profile } = useMyProfileQuery();
  const saveProfile = useSaveProfileDetailsMutation();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [banner, setBanner] = useState<PickedImage | null>(null);
  const [avatar, setAvatar] = useState<PickedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setBio(profile.bio);
  }, [profile]);

  const uploadPickedImagesAndSaveProfile = async () => {
    setError(null);
    setUploading(true);
    try {
      const bannerMediaId = banner ? await uploadProfileImageAndReturnMediaId(banner.uri, banner.contentType, "banner") : undefined;
      const avatarMediaId = avatar ? await uploadProfileImageAndReturnMediaId(avatar.uri, avatar.contentType, "avatar") : undefined;
      await saveProfile.mutateAsync({ name: name.trim(), bio: bio.trim(), ...(bannerMediaId ? { bannerMediaId } : {}), ...(avatarMediaId ? { avatarMediaId } : {}) });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your profile");
    } finally {
      setUploading(false);
    }
  };

  const bannerUri = banner?.uri ?? profile?.bannerUrl ?? null;
  const avatarUri = avatar?.uri ?? profile?.avatarUrl ?? null;

  return (
    <Screen background={colors.surface}>
      <Header title="Profile" paddingHorizontal={12} />
      <View style={styles.flex}>
        <KeyboardAwareScrollView bottomOffset={KEYBOARD_BOTTOM_OFFSET} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" accessibilityLabel="Change banner image" onPress={async () => setBanner((await pickSquareOrWideImageFromLibrary([3, 1])) ?? banner)} style={styles.banner}>
            {bannerUri ? <Image source={{ uri: bannerUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <CameraBolt24Icon />
          </Pressable>

          <View style={styles.identity}>
            <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={async () => setAvatar((await pickSquareOrWideImageFromLibrary([1, 1])) ?? avatar)} style={styles.avatar}>
              {avatarUri ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <CameraBolt24Icon />
            </Pressable>
            <View style={styles.names}>
              <View style={styles.nameRow}>
                <Text size={16} weight={500} lineHeight={19.2} numberOfLines={1}>
                  {name || profile?.name}
                </Text>
                {profile?.verified ? <SealCheck20Icon /> : null}
              </View>
              <Text size={14} lineHeight={16.8} color={colors.textMuted}>
                @{profile?.username}
              </Text>
              <Text size={14} weight={500} lineHeight={16.8}>
                {profile?.followers ?? 0} <Text size={14} lineHeight={16.8} color={colors.textMuted}>followers</Text>
                {"  "}
                {profile?.following ?? 0} <Text size={14} lineHeight={16.8} color={colors.textMuted}>following</Text>
              </Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text size={14} lineHeight={16.8} color={colors.textMuted}>
              Name
            </Text>
            <TextInput value={name} onChangeText={setName} maxLength={50} accessibilityLabel="Name" autoComplete="name" style={[styles.input, styles.nameInput]} placeholderTextColor={colors.textSubtle} />
          </View>
          <View style={styles.field}>
            <Text size={14} lineHeight={16.8} color={colors.textMuted}>
              Bio
            </Text>
            <TextInput value={bio} onChangeText={setBio} maxLength={160} multiline accessibilityLabel="Bio" style={[styles.input, styles.bioInput]} placeholderTextColor={colors.textSubtle} />
          </View>
          {error ? (
            <Text size={12} lineHeight={14.4} color={colors.error}>
              {error}
            </Text>
          ) : null}
        </KeyboardAwareScrollView>
        <View style={styles.footer}>
          <Button title="Save" disabled={!name.trim()} loading={uploading} onPress={uploadPickedImagesAndSaveProfile} />
        </View>
      </View>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 12, paddingBottom: 24 },
  banner: { height: 123, marginTop: 1, borderRadius: 8, backgroundColor: colors.chip, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  identity: { marginTop: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.chip, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  names: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  field: { marginTop: 24, gap: 8 },
  input: {
    minHeight: 41,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fontFamily[400],
  },
  nameInput: { fontSize: 12, letterSpacing: -0.24 },
  bioInput: { fontSize: 13, letterSpacing: -0.26, textAlignVertical: "top" },
  footer: { paddingHorizontal: 12, paddingBottom: 12 },
}));
