import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

import { DISAPPEARING_MESSAGE_CHOICES } from "./conversationDisplay.util";
import { SmallTab } from "./smallTab";

export interface DisappearingMessagesPickerProps {
  readonly selectedSeconds: number | null;
  readonly disabled: boolean;
  readonly onSelectSeconds: (seconds: number | null) => void;
}

export function DisappearingMessagesPicker({ selectedSeconds, disabled, onSelectSeconds }: DisappearingMessagesPickerProps) {
  return (
    <View style={styles.root}>
      <Text size={14} weight={600} lineHeight={16.8}>
        Disappearing messages
      </Text>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        New messages will disappear from this chat after the time you choose.
      </Text>
      <View style={styles.choices} accessibilityRole="radiogroup">
        {DISAPPEARING_MESSAGE_CHOICES.map((choice) => (
          <SmallTab
            key={choice.label}
            label={choice.label}
            selected={(selectedSeconds ?? null) === choice.seconds}
            onPress={() => {
              if (!disabled) onSelectSeconds(choice.seconds);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  choices: { flexDirection: "row", gap: 6, marginTop: 6 },
});
