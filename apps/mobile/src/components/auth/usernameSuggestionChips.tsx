import { View } from "react-native";

import { Chip, chipStyles } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface UsernameSuggestionChipsProps {
  readonly suggestions: readonly string[];
  readonly onSelect: (username: string) => void;
}

export function UsernameSuggestionChips({ suggestions, onSelect }: UsernameSuggestionChipsProps) {
  const { colors } = useTheme();
  if (suggestions.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
        Try one of these, or type your own
      </Text>
      <View style={chipStyles.row}>
        {suggestions.map((suggestion) => (
          <Chip key={suggestion} label={`@${suggestion}`} onPress={() => onSelect(suggestion)} />
        ))}
      </View>
    </View>
  );
}
