import { useNavigation, type NavigationProp } from "@react-navigation/native";
import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Quotes24Icon, Repeat24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { isViewerSignedIn, requireAuthThen } from "@/utils/requireAuth.util";
import { usePostInteractions } from "@/hooks/usePostInteractions.hook";
import type { Post } from "@/types";

export interface ReshareSheetProps {
  readonly post: Pick<Post, "id"> & Partial<Pick<Post, "reposted">> | null;
  readonly onClose: () => void;
}

export function ReshareSheet({ post, onClose }: ReshareSheetProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const { resharePost, undoRepost } = usePostInteractions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reposted = post?.reposted === true;

  const close = () => {
    setError(null);
    setBusy(false);
    onClose();
  };

  const toggleRepost = async () => {
    if (!post || busy) return;
    const run = () => (reposted ? undoRepost(post) : resharePost(post));
    if (!isViewerSignedIn()) {
      close();
      requireAuthThen(() => run().then(() => undefined, () => undefined), undefined, "repost posts");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await run();
      close();
    } catch {
      setError(reposted ? "We couldn’t undo that repost. Please try again." : "We couldn’t repost that. Please try again.");
      setBusy(false);
    }
  };

  const openQuoteComposer = () => {
    if (!post) return;
    const postId = post.id;
    close();
    requireAuthThen(() => navigation.navigate("CreatePost", { mode: "post", quotePostId: postId }), undefined, "quote posts");
  };

  return (
    <BottomSheet visible={!!post} onClose={close} floating>
      <View style={styles.options}>
        <OptionRow icon={<Repeat24Icon />} label={reposted ? "Undo repost" : "Repost"} disabled={busy} onPress={() => void toggleRepost()} />
        <OptionRow icon={<Quotes24Icon />} label="Quote" disabled={busy} onPress={openQuoteComposer} />
      </View>
      {error ? (
        <Text size={12} weight={500} lineHeight={14.4} color={colors.error} style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

function OptionRow({ icon, label, disabled, onPress }: { icon: ReactNode; label: string; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={styles.optionRow}>
      <View style={styles.optionIcon}>{icon}</View>
      <Text size={15} weight={500} lineHeight={18} color={colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: { paddingVertical: 8 },
  optionRow: { minHeight: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  optionIcon: { width: 24, alignItems: "center" },
  error: { paddingHorizontal: 16, paddingBottom: 8 },
});
