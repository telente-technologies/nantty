import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CaretDown24Icon, Check16Icon, Plus16Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { brandsService } from "@/services/brands.service";
import { useActingProfileStore } from "@/store/actingProfile.store";

import { VerificationBadge } from "./verificationBadge";

const KIND_LABELS = { person: "Personal profile", brand: "Brand", store: "Store" } as const;

export function ProfileSwitcher() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [sheetVisible, setSheetVisible] = useState(false);
  const { actingProfile, setActingProfile } = useActingProfileStore();
  const profiles = useQuery({ queryKey: ["users", "me", "profiles"], queryFn: brandsService.listMyProfiles });
  const current = useQuery({ queryKey: ["users", "me", "acting-profile"], queryFn: brandsService.fetchMyActingProfile });

  useEffect(() => {
    if (current.data && !actingProfile) setActingProfile(current.data);
  }, [current.data, actingProfile, setActingProfile]);

  const switchProfile = useMutation({
    mutationFn: brandsService.switchActingProfile,
    onSuccess: (profile) => {
      setActingProfile(profile);
      queryClient.setQueryData(["users", "me", "acting-profile"], profile);
      setSheetVisible(false);
    },
  });
  const active = actingProfile ?? current.data;
  if (!active) return null;

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Acting as ${active.name}. Switch profile`} onPress={() => setSheetVisible(true)} style={styles.chip}>
        <Avatar uri={active.avatarUrl} size={22} />
        <Text size={13} weight={500} lineHeight={16.9}>Acting as {active.name}</Text>
        <CaretDown24Icon size={16} />
      </Pressable>
      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} title="Switch profile">
        <View style={styles.list}>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>Posts, messages and store actions happen as the profile you choose.</Text>
          {(profiles.data ?? []).map((profile) => (
            <Pressable key={profile.id} accessibilityRole="radio" accessibilityState={{ checked: profile.id === active.id }} onPress={() => switchProfile.mutate(profile.id)} style={styles.row}>
              <Avatar uri={profile.avatarUrl} size={40} />
              <View style={styles.texts}>
                <View style={styles.nameRow}>
                  <Text size={14} weight={500} lineHeight={16.8}>{profile.name}</Text>
                  <VerificationBadge verification={profile.verification} size={14} />
                </View>
                <Text size={12} lineHeight={16} color={colors.textSubtle}>@{profile.handle} · {KIND_LABELS[profile.kind]}</Text>
              </View>
              {profile.id === active.id ? <Check16Icon color={colors.primary} /> : null}
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => { setSheetVisible(false); navigation.navigate("CreateBrand"); }} style={styles.row}>
            <View style={styles.plus}><Plus16Icon color={colors.primary} /></View>
            <Text size={14} weight={500} lineHeight={16.8} color={colors.primary}>Create a brand profile</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: "flex-start", marginHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider },
  list: { paddingHorizontal: 16, paddingBottom: 20, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  texts: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  plus: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
});
