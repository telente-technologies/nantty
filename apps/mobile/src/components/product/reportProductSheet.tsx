import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Flag24Icon, SealCheck20Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { REPORT_REASON_OPTIONS, reportsService, type ReportReason } from "@/services/moderation/reports.service";

const PRODUCT_REASON_LABEL_OVERRIDES: Partial<Record<ReportReason, string>> = {
  counterfeit_product: "Counterfeit / fake brand (trademark claim)",
};

export function ReportProductSheet({ productId, visible, onClose }: { productId: string; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [submitted, setSubmitted] = useState(false);
  const report = useMutation({
    mutationFn: (reason: ReportReason) => reportsService.submitReportForContent({ targetType: "product", targetId: productId, reason, details: "" }),
    onSuccess: () => setSubmitted(true),
  });
  const close = () => {
    setSubmitted(false);
    onClose();
  };
  const reasons = [...REPORT_REASON_OPTIONS].sort((a, b) => (a.reason === "counterfeit_product" ? -1 : b.reason === "counterfeit_product" ? 1 : 0));
  return (
    <BottomSheet visible={visible} onClose={close} title={submitted ? "Thanks for reporting" : "Report this product"}>
      {submitted ? (
        <View style={styles.body}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
            <SealCheck20Icon size={22} color={colors.textMuted} />
          </View>
          <Text size={13} lineHeight={17.5} color={colors.textMuted}>We'll review the listing. Brand owners can also file trademark claims from the Nantty Dashboard.</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.body}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
            <Flag24Icon size={22} color={colors.error} />
          </View>
          {reasons.map((option) => (
            <Pressable key={option.reason} accessibilityRole="button" disabled={report.isPending} onPress={() => report.mutate(option.reason)} style={styles.option}>
              <Flag24Icon size={20} color={colors.textMuted} />
              <Text size={15} lineHeight={18}>{PRODUCT_REASON_LABEL_OVERRIDES[option.reason] ?? option.label}</Text>
            </Pressable>
          ))}
          {report.isError ? <Text size={12} color={colors.error}>{report.error.message}</Text> : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { maxHeight: 440 },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  option: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.background },
}));
