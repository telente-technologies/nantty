import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { sellerService } from "@/services/seller.service";
import type { SellerApplicationInput } from "@/types/account.type";

const EMPTY_APPLICATION: SellerApplicationInput = { storeName: "", category: "", phone: "", address: "", description: "" };

export function SellerApplicationScreen({ navigation }: MainScreenProps<"SellerApplication">) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SellerApplicationInput>(EMPTY_APPLICATION);
  const { data: application, isLoading } = useQuery({ queryKey: sellerQueryKeys.application, queryFn: sellerService.fetchMySellerApplication });
  const submitApplication = useMutation({
    mutationFn: () => sellerService.submitSellerApplication(form),
    onSuccess: (submitted) => queryClient.setQueryData(sellerQueryKeys.application, submitted),
  });
  const updateField = (field: keyof SellerApplicationInput) => (value: string) => setForm((f) => ({ ...f, [field]: value }));
  const formIsComplete = Object.values(form).every((v) => v.trim().length > 0);

  if (application) {
    return (
      <Screen>
        <Header title="Become a seller" />
        <View style={styles.status}>
          <Text size={18} weight={600} lineHeight={21.6} align="center">
            {application.status === "approved" ? "You're approved!" : application.status === "rejected" ? "Application not approved" : "Application received"}
          </Text>
          <Text size={14} lineHeight={19.6} color={colors.textMuted} align="center">
            {application.status === "pending"
              ? `We're reviewing ${application.storeName}. You'll get a notification once it's approved, usually within 2 working days.`
              : application.status === "approved"
                ? "Your store is live. Start listing products from your dashboard."
                : "Contact support to learn more or to apply again."}
          </Text>
          {application.status === "approved" ? <Button title="Go to dashboard" onPress={() => navigation.replace("SellerDashboard")} /> : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Become a seller" />
      {isLoading ? null : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text size={14} lineHeight={19.6} color={colors.textMuted}>
            Tell us about your store. Buyers pay into escrow, and you're paid once they confirm delivery.
          </Text>
          <TextField label="Store name" placeholder="Usershop Name" value={form.storeName} onChangeText={updateField("storeName")} />
          <TextField label="What do you sell?" placeholder="e.g. Fashion, Gadgets" value={form.category} onChangeText={updateField("category")} />
          <TextField label="Business phone number" placeholder="0907 750 5722" keyboardType="phone-pad" value={form.phone} onChangeText={updateField("phone")} />
          <TextField label="Pickup address" placeholder="Where orders are collected from" value={form.address} onChangeText={updateField("address")} />
          <TextField label="About your store" placeholder="A short description buyers will see" value={form.description} onChangeText={updateField("description")} multiline boxStyle={styles.multiline} />
          {submitApplication.isError ? (
            <Text size={12} lineHeight={14.4} color={colors.error}>
              {submitApplication.error.message}
            </Text>
          ) : null}
          <Button title="Submit application" disabled={!formIsComplete} loading={submitApplication.isPending} onPress={() => submitApplication.mutate()} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 20 },
  multiline: { height: 96, alignItems: "flex-start", paddingVertical: 12 },
  status: { flex: 1, paddingHorizontal: 32, justifyContent: "center", gap: 16 },
});
