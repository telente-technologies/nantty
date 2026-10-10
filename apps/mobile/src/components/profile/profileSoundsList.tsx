import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { SpeakerHigh24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { soundsService } from "@/services/clips/sounds.service";
import type { User } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { ListSkeleton } from "@/components/ui/listSkeleton";

export function ProfileSoundsList({ profile }: { profile: User }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const sounds = useQuery({
    queryKey: ["users", profile.id, "sounds"],
    queryFn: async () => (await soundsService.searchSounds(profile.username)).filter((sound) => sound.owner.id === profile.id && sound.isOriginal),
  });
  if (sounds.isLoading) return <ListSkeleton />;
  if (!sounds.data?.length) return <Text size={14} color={colors.textSubtle} align="center" style={styles.state}>No original sounds yet</Text>;
  return (
    <View style={styles.list}>
      {sounds.data.map((sound) => (
        <Pressable key={sound.id} accessibilityRole="button" accessibilityLabel={`Sound ${sound.title}`} onPress={() => navigation.navigate("Sound", { soundId: sound.id })} style={styles.row}>
          <View style={styles.cover}>
            {sound.coverUrl ? <Image source={{ uri: sound.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <SpeakerHigh24Icon />}
          </View>
          <View style={styles.texts}>
            <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1}>{sound.title}</Text>
            <Text size={12} lineHeight={16} color={colors.textSubtle}>{formatCountWithThousandsSuffix(sound.usageCount)} clips</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  state: { marginTop: 48 },
  list: { paddingHorizontal: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  cover: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.skeleton, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  texts: { flex: 1, gap: 2 },
}));
