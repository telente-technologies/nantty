import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Check16Icon, Plus16Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { brandsService } from "@/services/sellers/brands.service";
import { useActingProfileStore } from "@/store/actingProfile.store";
import { useProfileSwitcherSheetStore } from "@/store/profileSwitcherSheet.store";

import { verificationForProfileKind } from "@/utils/verificationProfile.util";

import { VerificationBadge } from "./verificationBadge";

const KIND_LABELS = { person: "Personal", business: "Business", brand: "Brand", store: "Store", government: "Government" } as const;

function useActingProfileWithServerFallback() {
  const { actingProfile, setActingProfile } = useActingProfileStore();
  const current = useQuery({ queryKey: ["users", "me", "acting-profile"], queryFn: brandsService.fetchMyActingProfile });
  useEffect(() => {
    if (current.data && !actingProfile) setActingProfile(current.data);
  }, [current.data, actingProfile, setActingProfile]);
  return actingProfile ?? current.data ?? null;
}

export function ProfileSwitcherSheet() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { isProfileSwitcherSheetVisible, closeProfileSwitcherSheet } = useProfileSwitcherSheetStore();
  const setActingProfile = useActingProfileStore((s) => s.setActingProfile);
  const active = useActingProfileWithServerFallback();
  const profiles = useQuery({ queryKey: ["users", "me", "profiles"], queryFn: brandsService.listMyProfiles, enabled: isProfileSwitcherSheetVisible });

  const switchProfile = useMutation({
    mutationFn: brandsService.switchActingProfile,
    onSuccess: (profile) => {
      setActingProfile(profile);
      queryClient.setQueryData(["users", "me", "acting-profile"], profile);
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
      queryClient.invalidateQueries({ queryKey: ["users", profile.id, "posts"] });
      closeProfileSwitcherSheet();
    },
  });
  if (!active) return null;

  return (
    <BottomSheet visible={isProfileSwitcherSheetVisible} onClose={closeProfileSwitcherSheet} title="Switch profile" subtitle="Posts, messages and store actions happen as the profile you choose." scrollable>
      <View style={styles.list}>
        {profiles.isPending ? <ListSkeleton rows={3} padding={0} /> : null}
        {profiles.isError ? <ErrorState message="Couldn't load your profiles." onRetry={() => profiles.refetch()} /> : null}
        {(profiles.data ?? []).map((profile) => (
          <Pressable key={profile.id} accessibilityRole="radio" accessibilityState={{ checked: profile.id === active.id }} onPress={() => switchProfile.mutate(profile.id)} style={[styles.row, styles.profileRow, profile.id === active.id ? styles.profileRowActive : null]}>
            <Avatar uri={profile.avatarUrl} size={40} />
            <View style={styles.texts}>
              <View style={styles.nameRow}>
                <Text size={14} weight={500} lineHeight={16.8}>{profile.name}</Text>
                <VerificationBadge verification={verificationForProfileKind(profile.verification, profile.kind)} size={14} />
              </View>
              <Text size={12} lineHeight={16} color={colors.textMuted}>@{profile.handle} · {KIND_LABELS[profile.kind]}</Text>
            </View>
            <View style={[styles.radio, profile.id === active.id ? styles.radioOn : null]}>{profile.id === active.id ? <Check16Icon size={12} color={colors.onPrimary} /> : null}</View>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={() => { closeProfileSwitcherSheet(); navigation.navigate("CreateBusinessProfile"); }} style={styles.row}>
          <View style={styles.plus}><Plus16Icon color={colors.primary} /></View>
          <Text size={14} weight={500} lineHeight={16.8} color={colors.primary}>Create business profile</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { closeProfileSwitcherSheet(); navigation.navigate("CreateBrand"); }} style={styles.row}>
          <View style={styles.plus}><Plus16Icon color={colors.primary} /></View>
          <Text size={14} weight={500} lineHeight={16.8} color={colors.primary}>Create a brand profile</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { paddingTop: 4, gap: 8 },
  profileRow: { paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.divider },
  profileRowActive: { borderColor: colors.primarySolid, backgroundColor: colors.primaryTint },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.textMuted, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.primarySolid, backgroundColor: colors.primarySolid },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  texts: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  plus: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
}));
