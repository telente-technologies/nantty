import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { SignUpContactChannel } from "@/store/signup.store";

const TAB_LABELS: Record<SignUpContactChannel, string> = { phone: "Phone number", email: "Email" };

export interface ContactChannelTabsProps {
  readonly selectedChannel: SignUpContactChannel;
  readonly onSelectChannel: (channel: SignUpContactChannel) => void;
}

export function ContactChannelTabs({ selectedChannel, onSelectChannel }: ContactChannelTabsProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {(Object.keys(TAB_LABELS) as SignUpContactChannel[]).map((channel) => {
        const selected = channel === selectedChannel;
        return (
          <Pressable
            key={channel}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelectChannel(channel)}
            style={[styles.tab, selected && styles.selectedTab]}
          >
            <Text size={15} weight={500} lineHeight={21} color={selected ? colors.text : colors.textSubtle}>
              {TAB_LABELS[channel]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  tab: { flex: 1, height: 41, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.divider },
  selectedTab: { borderBottomColor: colors.black },
});
