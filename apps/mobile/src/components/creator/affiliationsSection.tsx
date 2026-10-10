import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Handshake24Icon, Storefront24Icon } from "@/components/icons";
import { StatusPill } from "@/components/escrow/statusPill";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { creatorProgramService } from "@/services/creators/creatorProgram.service";
import { productsService } from "@/services/sellers/products.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { creatorQueryKeys } from "./creatorQueries.hook";

const AFFILIATION_TONE = { active: "success", requested: "caution", declined: "error" } as const;

export function AffiliationsSection() {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [pickerVisible, setPickerVisible] = useState(false);
  const affiliations = useQuery({ queryKey: creatorQueryKeys.affiliations, queryFn: creatorProgramService.listMyAffiliations });
  const candidates = useQuery({ queryKey: ["products", "featured"], queryFn: productsService.fetchFeaturedProducts, enabled: pickerVisible });
  const requestAffiliation = useMutation({
    mutationFn: (productId: string) => creatorProgramService.requestAffiliation({ productId }),
    onSuccess: () => {
      setPickerVisible(false);
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.affiliations });
    },
  });
  const affiliatedProductIds = new Set((affiliations.data ?? []).map((a) => a.product?.id).filter(Boolean));

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Handshake24Icon size={20} color={colors.textMuted} />
        <Text size={16} weight={600} lineHeight={19.2}>Affiliated sellers & products</Text>
      </View>
      {(affiliations.data ?? []).map((affiliation) => (
        <View key={affiliation.id} style={styles.row}>
          <Image source={{ uri: affiliation.product?.imageUrl ?? affiliation.store.logoUrl ?? undefined }} style={styles.thumb} contentFit="cover" />
          <View style={styles.flex}>
            <Text size={14} lineHeight={16.8} numberOfLines={1}>{affiliation.product?.name ?? `All products · ${affiliation.store.name}`}</Text>
            <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
              {affiliation.store.name} · {affiliation.commissionPercent}% · {affiliation.salesCount} sales · {formatMoneyForDisplay(affiliation.earned)}
            </Text>
          </View>
          <StatusPill label={affiliation.status === "requested" ? "Requested" : affiliation.status === "active" ? "Active" : "Declined"} tone={AFFILIATION_TONE[affiliation.status]} />
        </View>
      ))}
      <Button variant="subtle" title="Find products to promote" onPress={() => setPickerVisible(true)} />
      <BottomSheet visible={pickerVisible} onClose={() => setPickerVisible(false)} title="Request affiliation">
        <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetContent}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
            <Storefront24Icon size={22} color={colors.textMuted} />
          </View>
          {(candidates.data ?? []).filter((product) => !affiliatedProductIds.has(product.id)).map((product) => (
            <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={`Request to promote ${product.name}`} disabled={requestAffiliation.isPending} onPress={() => requestAffiliation.mutate(product.id)} style={styles.row}>
              <Image source={{ uri: product.imageUrl ?? undefined }} style={styles.thumb} contentFit="cover" />
              <Text size={14} lineHeight={16.8} style={styles.flex} numberOfLines={1}>{product.name}</Text>
              <Text size={13} weight={500} lineHeight={16.9} color={colors.primary}>Request</Text>
            </Pressable>
          ))}
          {requestAffiliation.isError ? <Text size={12} color={colors.error}>{requestAffiliation.error.message}</Text> : null}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: colors.placeholder },
  sheetList: { maxHeight: 420 },
  sheetContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
}));
