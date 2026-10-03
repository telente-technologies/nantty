import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  ArrowLeft24Icon,
  DotsThreeVertical24Icon,
  Frame75132Icon,
  Frame75232Icon,
  Frame75332Icon,
  MagnifyingGlass24Icon,
} from "@/components/icons";
import { makeThemedStyles, useTheme } from "@/theme";

export interface ProfileHeaderBarProps {
  readonly variant: "own" | "other";
  readonly onBack?: () => void;
  readonly onSearch: () => void;
  readonly onMore: () => void;
}

function OwnProfileCircleButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={styles.circle}>
      {children}
    </Pressable>
  );
}

function OtherProfileSquareButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress}>
      {children}
    </Pressable>
  );
}

export function ProfileHeaderBar({ variant, onBack, onSearch, onMore }: ProfileHeaderBarProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (variant === "own") {
    return (
      <View style={[styles.bar, styles.ownBar]}>
        {onBack ? (
          <OwnProfileCircleButton label="Go back" onPress={onBack}>
            <ArrowLeft24Icon size={16} color={colors.primary} />
          </OwnProfileCircleButton>
        ) : (
          <View />
        )}
        <View style={styles.actions}>
          <OwnProfileCircleButton label="Search" onPress={onSearch}>
            <MagnifyingGlass24Icon size={16} color={colors.primary} />
          </OwnProfileCircleButton>
          <OwnProfileCircleButton label="Settings and more" onPress={onMore}>
            <DotsThreeVertical24Icon size={16} color={colors.primary} />
          </OwnProfileCircleButton>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.bar, styles.otherBar]}>
      {onBack ? (
        <OtherProfileSquareButton label="Go back" onPress={onBack}>
          <Frame75332Icon />
        </OtherProfileSquareButton>
      ) : (
        <View />
      )}
      <View style={styles.actions}>
        <OtherProfileSquareButton label="Search" onPress={onSearch}>
          <Frame75232Icon />
        </OtherProfileSquareButton>
        <OtherProfileSquareButton label="More options" onPress={onMore}>
          <Frame75132Icon />
        </OtherProfileSquareButton>
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  bar: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ownBar: { paddingLeft: 16, paddingRight: 12 },
  otherBar: { paddingHorizontal: 12, paddingTop: 8, height: 52 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  circle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
}));
