import { StyleSheet, View } from "react-native";

import { SealCheck20Icon, Swords24Icon, UserCircle24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { ModalActionStack } from "@/components/ui/modalActions";
import { buildModalPalette } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { LiveBattleProposal } from "@/types/liveStage.type";

const CONSENT_LABEL = { pending: "Waiting…", accepted: "Accepted", declined: "Declined" } as const;

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
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const palette = buildModalPalette(colors, scheme);
  const { proposal } = props;
  if (!proposal) return null;
  const nameOf = (userId: string) => proposal.participants.find((user) => user.id === userId)?.name ?? "Guest";
  const minutes = Math.round(proposal.durationSeconds / 60);
  return (
    <BottomSheet visible={props.isVisible} onClose={props.onClose} title="Winner takes all?" subtitle={`${minutes}-minute battle`} floating>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <Swords24Icon size={22} color={colors.textMuted} />
        </View>
        <Text size={13} lineHeight={18} color={colors.textMuted}>
          {props.isHostView ? "You" : props.hostName} proposed a {minutes}-minute winner-takes-all battle. When it ends, every coin contributed to the other participants goes to the
          winner. A draw means everyone keeps their own coins. Every guest has to accept first.
        </Text>
        {props.isHostView
          ? proposal.consents.map((consent) => (
              <View key={consent.userId} style={styles.row}>
                {consent.state === "accepted" ? (
                  <SealCheck20Icon size={20} color={colors.successText} />
                ) : (
                  <UserCircle24Icon size={20} color={colors.textMuted} />
                )}
                <Text size={14} lineHeight={17} style={styles.flex} numberOfLines={1}>
                  {nameOf(consent.userId)}
                </Text>
                <Text size={13} weight={600} lineHeight={16} color={consent.state === "declined" ? palette.destructiveInk : consent.state === "accepted" ? colors.successText : colors.textMuted}>
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
            <ModalActionStack
              actions={[
                { label: "Run normal battle", style: "primary", loading: props.isActionPending, onPress: () => props.onRunWithoutWinnerTakesAll(proposal.id) },
                { label: "Cancel battle", style: "secondary", onPress: () => props.onCancel(proposal.id) },
              ]}
            />
          </>
        ) : null}
        {props.isHostView && !proposal.needsHostDecision ? <ModalActionStack actions={[{ label: "Cancel battle", style: "secondary", onPress: () => props.onCancel(proposal.id) }]} /> : null}
        {!props.isHostView ? (
          <ModalActionStack
            actions={[
              { label: "Accept", style: "primary", loading: props.isActionPending, onPress: () => props.onAccept(proposal.id) },
              { label: "Decline", style: "secondary", onPress: () => props.onDecline(proposal.id) },
            ]}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

export const isMyConsentPending = (proposal: LiveBattleProposal | null, userId: string | null) =>
  !!proposal && proposal.consents.some((consent) => consent.userId === userId && consent.state === "pending");

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  return StyleSheet.create({
    body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
    row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: palette.inset },
    flex: { flex: 1 },
  });
});
