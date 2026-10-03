import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CaretDown24Icon, Check16Icon, Plus16Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { brandsService } from "@/services/brands.service";
import { useCreatorEntry } from "@/hooks/useCreatorStatus.hook";
import { useActingProfileStore } from "@/store/actingProfile.store";
import { useProfileSwitcherSheetStore } from "@/store/profileSwitcherSheet.store";

import { verificationForProfileKind } from "@/utils/verificationProfile.util";

import { VerificationBadge } from "./verificationBadge";

const KIND_LABELS = { person: "Personal", creator: "Creator", business: "Business", brand: "Brand", store: "Store", government: "Government" } as const;

function useActingProfileWithServerFallback() {
  const { actingProfile, setActingProfile } = useActingProfileStore();
  const current = useQuery({ queryKey: ["users", "me", "acting-profile"], queryFn: brandsService.fetchMyActingProfile });
  useEffect(() => {
    if (current.data && !actingProfile) setActingProfile(current.data);
  }, [current.data, actingProfile, setActingProfile]);
  return actingProfile ?? current.data ?? null;
}

export function ProfileSwitcher() {
  const styles = useStyles();
  const active = useActingProfileWithServerFallback();
  const openProfileSwitcherSheet = useProfileSwitcherSheetStore((s) => s.openProfileSwitcherSheet);
  if (!active) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Acting as ${active.name}. Switch profile`} onPress={openProfileSwitcherSheet} style={styles.chip}>
      <Avatar uri={active.avatarUrl} size={22} />
      <Text size={13} weight={500} lineHeight={16.9}>Acting as {active.name}</Text>
      <CaretDown24Icon size={16} />
    </Pressable>
  );
}

export function ProfileSwitcherSheet() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { isProfileSwitcherSheetVisible, closeProfileSwitcherSheet } = useProfileSwitcherSheetStore();
  const setActingProfile = useActingProfileStore((s) => s.setActingProfile);
  const active = useActingProfileWithServerFallback();
  const isCreatorApproved = useCreatorEntry().route === "CreatorDashboard";
  const profiles = useQuery({ queryKey: ["users", "me", "profiles"], queryFn: brandsService.listMyProfiles, enabled: isProfileSwitcherSheetVisible });

  const switchProfile = useMutation({
    mutationFn: brandsService.switchActingProfile,
    onSuccess: (profile) => {
      setActingProfile(profile);
      queryClient.setQueryData(["users", "me", "acting-profile"], profile);
      closeProfileSwitcherSheet();
    },
  });
  if (!active) return null;

  return (
    <BottomSheet visible={isProfileSwitcherSheetVisible} onClose={closeProfileSwitcherSheet} title="Switch profile">
      <View style={styles.list}>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>Posts, messages and store actions happen as the profile you choose.</Text>
        {profiles.isPending ? <ListSkeleton rows={3} padding={0} /> : null}
        {profiles.isError ? <ErrorState message="Couldn't load your profiles." onRetry={() => profiles.refetch()} /> : null}
        {(profiles.data ?? []).filter((profile) => profile.kind !== "creator" || isCreatorApproved).map((profile) => (
          <Pressable key={profile.id} accessibilityRole="radio" accessibilityState={{ checked: profile.id === active.id }} onPress={() => switchProfile.mutate(profile.id)} style={styles.row}>
            <Avatar uri={profile.avatarUrl} size={40} />
            <View style={styles.texts}>
              <View style={styles.nameRow}>
                <Text size={14} weight={500} lineHeight={16.8}>{profile.name}</Text>
                <VerificationBadge verification={verificationForProfileKind(profile.verification, profile.kind)} size={14} />
              </View>
              <Text size={12} lineHeight={16} color={colors.textSubtle}>@{profile.handle} · {KIND_LABELS[profile.kind]}</Text>
            </View>
            {profile.id === active.id ? <Check16Icon color={colors.primary} /> : null}
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
  chip: { alignSelf: "flex-start", marginHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  list: { paddingHorizontal: 16, paddingBottom: 20, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  texts: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  plus: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
}));
