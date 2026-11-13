import { Pressable, View } from "react-native";
import { ArrowLeft24Icon, Headset24Icon, Plus24Icon, Share24Icon } from "@/components/icons";
import type { SpaceSummary } from "@/services/spaces.service";
import { useTheme } from "@/theme";
import type { useSpacesStyles } from "./spaces.styles";

type SpaceStyles = ReturnType<typeof useSpacesStyles>;

export interface SpacesScreenHeaderProps {
  readonly styles: SpaceStyles;
  readonly space: SpaceSummary | undefined;
  readonly host: boolean;
  readonly onBack: () => void;
  readonly onCreate: () => void;
  readonly onShare: (space: SpaceSummary) => void;
}

export function SpacesScreenHeader({
  styles,
  space,
  host,
  onBack,
  onCreate,
  onShare,
}: SpacesScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.header}>
      <Pressable
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
      >
        <ArrowLeft24Icon />
      </Pressable>
      <View accessibilityRole="header" accessibilityLabel="Spaces">
        <Headset24Icon size={22} color={colors.text} />
      </View>
      {space ? (
        space.visibility !== "invite_only" || host ? (
          <Pressable
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={space.visibility === "invite_only" ? "Share private Space in chat" : "Share Space"}
            onPress={() => onShare(space)}
          >
            <Share24Icon />
          </Pressable>
        ) : <View style={styles.iconButton} />
      ) : (
        <Pressable
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Create a Space"
          onPress={onCreate}
        >
          <Plus24Icon color={colors.text} />
        </Pressable>
      )}
    </View>
  );
}
