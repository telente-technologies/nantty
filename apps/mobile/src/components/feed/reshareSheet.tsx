import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ChatCircle24Icon, Refresh24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { usePostInteractions } from "@/hooks/usePostInteractions.hook";
import type { Post } from "@/types";

export interface ReshareSheetProps {
  readonly post: Post | null;
  readonly onClose: () => void;
}

export function ReshareSheet({ post, onClose }: ReshareSheetProps) {
  const { resharePost } = usePostInteractions();
  const [showComposer, setShowComposer] = useState(false);
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setShowComposer(false);
    setQuote("");
    setError(null);
    setBusy(false);
    onClose();
  };

  const reshareNow = async (text?: string) => {
    if (!post || busy) return;
    setBusy(true);
    setError(null);
    try {
      await resharePost(post, text);
      close();
    } catch {
      setError("We couldn’t reshare that. Please try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <BottomSheet visible={!!post && !showComposer} onClose={close} floating>
        <View style={styles.options}>
          <OptionRow icon={<Refresh24Icon />} label="Reshare" onPress={() => reshareNow()} />
          <OptionRow icon={<ChatCircle24Icon />} label="Quote" onPress={() => setShowComposer(true)} />
        </View>
        {error ? (
          <Text size={12} weight={500} lineHeight={14.4} color={colors.error} style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={!!post && showComposer} onClose={close} title="Quote" floating>
        <View style={styles.composer}>
          <TextField
            placeholder="Add a comment"
            value={quote}
            onChangeText={setQuote}
            multiline
            autoFocus
            boxStyle={styles.composerBox}
          />
          {error ? (
            <Text size={12} weight={500} lineHeight={14.4} color={colors.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button title="Repost" onPress={() => reshareNow(quote.trim())} loading={busy} disabled={!quote.trim() || busy} />
        </View>
      </BottomSheet>
    </>
  );
}

function OptionRow({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.optionRow}>
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
  composer: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  composerBox: { height: 96, alignItems: "flex-start", paddingVertical: 12 },
});
