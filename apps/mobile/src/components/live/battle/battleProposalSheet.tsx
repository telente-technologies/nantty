import { StyleSheet, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LiveBattleProposal } from "@/types/liveStage.type";

const CONSENT_LABEL = { pending: "Waiting…", accepted: "Accepted ✓", declined: "Declined" } as const;

export interface BattleProposalSheetProps {
  readonly proposal: LiveBattleProposal | null;
  readonly isHostView: boolean;
  readonly hostName: string;
  readonly signedInUserId: string | null;
  readonly isVisible: boolean;
  readonly isActionPending: boolean;
  readonly onAccept: (battleId: string) => void;
  readonly onDecline: (battleId: string) => void;
  readonly onRunWithoutWinnerTakesAll: (battleId: string) => void;
  readonly onCancel: (battleId: string) => void;
  readonly onClose: () => void;
}

export function BattleProposalSheet(props: BattleProposalSheetProps) {
  const { proposal } = props;
  if (!proposal) return null;
  const nameOf = (userId: string) => proposal.participants.find((user) => user.id === userId)?.name ?? "Guest";
  const minutes = Math.round(proposal.durationSeconds / 60);
  return (
    <BottomSheet visible={props.isVisible} onClose={props.onClose} title="Winner takes all?" floating>
      <View style={styles.body}>
        <Text size={13} lineHeight={18} color={colors.textMuted}>
          {props.isHostView ? "You" : props.hostName} proposed a {minutes}-minute winner-takes-all battle. When it ends, every coin gifted to the other streamers goes to the
          winner. A draw means everyone keeps their own coins. Every guest has to accept first.
        </Text>
        {props.isHostView
          ? proposal.consents.map((consent) => (
              <View key={consent.userId} style={styles.row}>
                <Text size={14} lineHeight={17} style={styles.flex} numberOfLines={1}>
                  {nameOf(consent.userId)}
                </Text>
                <Text size={13} weight={600} lineHeight={16} color={consent.state === "declined" ? colors.error : consent.state === "accepted" ? colors.success : colors.textMuted}>
                  {CONSENT_LABEL[consent.state]}
                </Text>
              </View>
            ))
          : null}
        {props.isHostView && proposal.needsHostDecision ? (
          <>
            <Text size={13} lineHeight={18}>
              Someone declined. Run it as a normal battle where everyone keeps their own coins, or cancel.
            </Text>
            <View style={styles.buttons}>
              <Button title="Cancel battle" variant="outline" style={styles.flex} onPress={() => props.onCancel(proposal.id)} />
              <Button title="Run normal battle" style={styles.flex} loading={props.isActionPending} onPress={() => props.onRunWithoutWinnerTakesAll(proposal.id)} />
            </View>
          </>
        ) : null}
        {props.isHostView && !proposal.needsHostDecision ? <Button title="Cancel battle" variant="outline" onPress={() => props.onCancel(proposal.id)} /> : null}
        {!props.isHostView ? (
          <View style={styles.buttons}>
            <Button title="Decline" variant="outline" style={styles.flex} onPress={() => props.onDecline(proposal.id)} />
            <Button title="Accept" style={styles.flex} loading={props.isActionPending} onPress={() => props.onAccept(proposal.id)} />
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

export const isMyConsentPending = (proposal: LiveBattleProposal | null, userId: string | null) =>
  !!proposal && proposal.consents.some((consent) => consent.userId === userId && consent.state === "pending");

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  buttons: { flexDirection: "row", gap: 10 },
});
