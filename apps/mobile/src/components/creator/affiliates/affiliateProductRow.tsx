import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { StatusPill } from "@/components/escrow/statusPill";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { webAppLinks } from "@/config/webAppLinks.config";
import { describeActionFailure } from "@/errors/errorExperience/describeError";
import { affiliatesService } from "@/services/creators/affiliates.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { AffiliateAccess, AffiliateLink } from "@/types/affiliate.type";

import { affiliateAccessLabels, affiliateAccessTones } from "./affiliateLabels.util";

export interface AffiliateProductRowProps {
  readonly productId: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly access: AffiliateAccess;
  readonly link: AffiliateLink | null;
  readonly details: readonly string[];
  readonly footer?: ReactNode;
}

export function AffiliateProductRow({ productId, name, imageUrl, access, link, details, footer }: AffiliateProductRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const copyLink = useMutation({
    mutationFn: async () => link ?? (await affiliatesService.createLink(productId)),
    onSuccess: async (created) => {
      await Clipboard.setStringAsync(webAppLinks.affiliateProduct({ id: productId, name }, created.id));
      setCopied(true);
      if (!link) void queryClient.invalidateQueries({ queryKey: ["affiliates"] });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: ["affiliates", "catalog"] }),
  });
  const request = useMutation({
    mutationFn: () => affiliatesService.requestToPromote(productId),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["affiliates"] }),
  });
  const failure = copyLink.error ?? request.error;
  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <Image source={{ uri: imageUrl ?? undefined }} style={styles.thumb} contentFit="cover" accessibilityIgnoresInvertColors />
        <View style={styles.flex}>
          <Text size={14} weight={600} lineHeight={18} numberOfLines={2}>{name || "Product no longer listed"}</Text>
          {details.map((detail) => <Text key={detail} size={12} lineHeight={16.8} color={colors.textSubtle}>{detail}</Text>)}
        </View>
        <StatusPill label={affiliateAccessLabels[access]} tone={affiliateAccessTones[access]} />
      </View>
      {footer}
      <View style={styles.actions}>
        {access === "approved" || access === "open" ? (
          <Button title={copied ? "Link copied" : "Copy link"} variant={copied ? "subtle" : "primary"} loading={copyLink.isPending} accessibilityLabel={`Copy your link for ${name}`} onPress={() => copyLink.mutate()} />
        ) : null}
        {access === "approval_required" ? <Button title="Request to promote" variant="outline" loading={request.isPending} onPress={() => request.mutate()} /> : null}
      </View>
      {failure ? <Text size={12} color={colors.error}>{describeActionFailure(failure)}</Text> : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 10 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.placeholder },
  actions: { flexDirection: "row", gap: 8 },
}));
