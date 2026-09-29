import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { REPORT_REASON_OPTIONS, reportsService, type ReportReason } from "@/services/reports.service";

const PRODUCT_REASON_LABEL_OVERRIDES: Partial<Record<ReportReason, string>> = {
  counterfeit_product: "Counterfeit / fake brand (trademark claim)",
};

export function ReportProductSheet({ productId, visible, onClose }: { productId: string; visible: boolean; onClose: () => void }) {
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
          <Text size={13} lineHeight={17.5} color={colors.textMuted}>We'll review the listing. Brand owners can also file trademark claims from the Zudomart Dashboard.</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.body}>
          {reasons.map((option) => (
            <Pressable key={option.reason} accessibilityRole="button" disabled={report.isPending} onPress={() => report.mutate(option.reason)} style={styles.option}>
              <Text size={15} lineHeight={18}>{PRODUCT_REASON_LABEL_OVERRIDES[option.reason] ?? option.label}</Text>
            </Pressable>
          ))}
          {report.isError ? <Text size={12} color={colors.error}>{report.error.message}</Text> : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 440 },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  option: { minHeight: 50, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.background },
});
