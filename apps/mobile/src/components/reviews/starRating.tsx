import { Pressable, StyleSheet, View } from "react-native";

import { Star16Icon, StarOutline16Icon } from "@/components/icons";
import { useTheme } from "@/theme";
import { filledStarCount, starsLabel } from "@/utils/productReviews.util";

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  const { colors } = useTheme();
  const filled = filledStarCount(rating);
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={starsLabel(rating)}>
      {Array.from({ length: 5 }, (_, index) =>
        index < filled ? <Star16Icon key={index} size={size} color={colors.star} /> : <StarOutline16Icon key={index} size={size} color={colors.textSubtle} />,
      )}
    </View>
  );
}

export function StarPicker({ value, onChange, size = 36, disabled }: { value: number; onChange: (rating: number) => void; size?: number; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, styles.picker]}>
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1;
        const selected = star <= value;
        return (
          <Pressable
            key={star}
            disabled={disabled}
            hitSlop={4}
            onPress={() => onChange(star)}
            accessibilityRole="button"
            accessibilityLabel={`${starsLabel(star)}, ${RATING_WORDS[star]}`}
            accessibilityState={{ selected: star === value, disabled }}
          >
            {selected ? <Star16Icon size={size} color={colors.star} /> : <StarOutline16Icon size={size} color={colors.textSubtle} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export const ratingWord = (rating: number) => RATING_WORDS[rating] ?? "";

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  picker: { gap: 8 },
});
