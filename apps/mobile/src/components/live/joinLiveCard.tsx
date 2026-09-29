import { StyleSheet, View } from "react-native";

import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { LiveSessionDetails } from "@/types";

import { LiveBadge } from "./liveBadge";

export interface JoinLiveCardProps {
  readonly session: LiveSessionDetails;
  readonly showHost: boolean;
  readonly onWatch: () => void;
}

export function JoinLiveCard({ session, showHost, onWatch }: JoinLiveCardProps) {
  return (
    <View style={styles.card}>
      <LiveBadge />
      {showHost ? (
        <View style={styles.host}>
          <Avatar uri={session.host.avatarUrl} size={32} />
          <Text size={14} weight={500} lineHeight={16.8}>
            {session.host.name}
          </Text>
          <VerificationBadge verification={session.host.verification} legacyVerified={session.host.verified} size={16} />
        </View>
      ) : (
        <Text size={21} weight={500} lineHeight={25.2} letterSpacing={-0.42}>
          Join {session.viewers} others watching this live right now
        </Text>
      )}
      <Button title="Watch live" onPress={onWatch} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 16, gap: 12 },
  host: { flexDirection: "row", alignItems: "center", gap: 9 },
  button: { marginTop: 0 },
});
