import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { invitationLinkStatus } from "@/utils/invitationLink.util";

interface InvitationLinkRecord {
  readonly id: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

interface ConversationInvitationLinksSectionProps {
  readonly title: string;
  readonly children?: ReactNode;
  readonly links: readonly InvitationLinkRecord[];
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly isRevoking: boolean;
  readonly revokingLinkId?: string;
  readonly onRetry: () => void;
  readonly onLoadMore: () => void;
  readonly onRevoke: (linkId: string) => void;
}

export function ConversationInvitationLinksSection({
  title,
  children,
  links,
  isPending,
  isError,
  hasNextPage,
  isFetchingNextPage,
  isRevoking,
  revokingLinkId,
  onRetry,
  onLoadMore,
  onRevoke,
}: ConversationInvitationLinksSectionProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.section}>
      <Text size={14} weight={600} lineHeight={18}>{title}</Text>
      {children}
      {isPending ? <Text size={12} color={colors.textMuted}>Loading invitation links…</Text> : null}
      {isError ? <Button title="Retry loading links" variant="subtle" onPress={onRetry} /> : null}
      {links.map((link) => {
        const status = invitationLinkStatus(link.expiresAt, link.revokedAt);
        const statusLabel = {
          active: "Active link",
          expired: "Expired link",
          revoked: "Revoked link",
          unknown: "Expiry unavailable",
        }[status];
        const rowBusy = isRevoking && revokingLinkId === link.id;

        return (
          <View key={link.id} style={[styles.row, { backgroundColor: colors.background, borderColor: colors.divider }]}>
            <View style={styles.meta}>
              <Text size={13} weight={600}>{statusLabel}</Text>
              <Text size={11} lineHeight={15} color={colors.textMuted}>
                Expires {Number.isFinite(Date.parse(link.expiresAt)) ? new Date(link.expiresAt).toLocaleString() : "date unavailable"}
              </Text>
            </View>
            {status !== "revoked" ? (
              <Button title={rowBusy ? "Revoking…" : "Revoke"} variant="subtle" height={36} loading={rowBusy} disabled={rowBusy} onPress={() => onRevoke(link.id)} />
            ) : null}
          </View>
        );
      })}
      {hasNextPage ? (
        <Button title="Load more links" variant="subtle" loading={isFetchingNextPage} disabled={isFetchingNextPage} onPress={onLoadMore} />
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  section: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, borderColor: colors.divider },
  meta: { flex: 1, gap: 2 },
}));
