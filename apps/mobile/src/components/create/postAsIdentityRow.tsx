import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { ProfileSwitcherSheet } from "@/components/profile/profileSwitcher";
import { makeThemedStyles, useTheme } from "@/theme";
import { brandsService } from "@/services/sellers/brands.service";
import { useActingProfileStore } from "@/store/actingProfile.store";
import { useProfileSwitcherSheetStore } from "@/store/profileSwitcherSheet.store";

const KIND_LABELS = { person: "Personal", business: "Business", brand: "Brand", store: "Store", government: "Government" } as const;

function useComposerIdentity() {
  const { actingProfile, setActingProfile } = useActingProfileStore();
  const current = useQuery({ queryKey: ["users", "me", "acting-profile"], queryFn: brandsService.fetchMyActingProfile });
  useEffect(() => {
    if (current.data && !actingProfile) setActingProfile(current.data);
  }, [current.data, actingProfile, setActingProfile]);
  return actingProfile ?? current.data ?? null;
}

export function PostAsIdentityRow() {
  const { colors } = useTheme();
  const styles = useStyles();
  const identity = useComposerIdentity();
  const openProfileSwitcherSheet = useProfileSwitcherSheetStore((s) => s.openProfileSwitcherSheet);
  if (!identity) return null;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Posting as ${identity.name}, ${KIND_LABELS[identity.kind]}. Change posting identity`}
        onPress={openProfileSwitcherSheet}
        style={styles.row}
      >
        <Avatar uri={identity.avatarUrl} size={36} />
        <View style={styles.texts}>
          <Text size={13} weight={600} lineHeight={16.9}>
            Posting as {identity.name}
          </Text>
          <Text size={12} lineHeight={16} color={colors.textMuted}>
            @{identity.handle} · {KIND_LABELS[identity.kind]} — followers see this post in Feed and on your {identity.kind === "person" ? "profile" : "store or brand page"}
          </Text>
        </View>
        <Text size={13} weight={600} lineHeight={16.9} color={colors.primary}>
          Change
        </Text>
      </Pressable>
      <ProfileSwitcherSheet />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  texts: { flex: 1, gap: 2 },
}));
