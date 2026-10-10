import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { payoutOnboardingService } from "@/services/commerce/payoutOnboarding.service";
import type { PayoutBusinessInput } from "@/types/payoutOnboarding.type";

import { StepFrame } from "./stepFrame";

const BUSINESS_TYPES: readonly { readonly value: PayoutBusinessInput["businessType"]; readonly label: string }[] = [
  { value: "sole_proprietorship", label: "Sole proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "limited_company", label: "Limited company" },
];

export function BusinessStep({ stepCount, onSaved }: { readonly stepCount: number; readonly onSaved: () => void }) {
  const { colors } = useTheme();
  const [cacNumber, setCacNumber] = useState("");
  const [businessType, setBusinessType] = useState<PayoutBusinessInput["businessType"]>("sole_proprietorship");
  const save = useMutation({ mutationFn: () => payoutOnboardingService.saveBusiness({ cacNumber: cacNumber.trim().toUpperCase(), businessType }), onSuccess: onSaved });

  return (
    <StepFrame
      stepNumber={2}
      stepCount={stepCount}
      title="Your business"
      why="Registered businesses are paid against their CAC registration, so we can match your store to the company that receives the money."
    >
      <TextField label="CAC registration number" placeholder="RC1234567 or BN1234567" autoCapitalize="characters" value={cacNumber} onChangeText={setCacNumber} />
      <Text size={14} lineHeight={16.8}>Business type</Text>
      <View style={styles.chips}>
        {BUSINESS_TYPES.map((option) => (
          <Chip key={option.value} kind="filter" label={option.label} selected={businessType === option.value} onPress={() => setBusinessType(option.value)} />
        ))}
      </View>
      {save.isError ? <Text size={12} lineHeight={14.4} color={colors.error}>{save.error.message}</Text> : null}
      <Button title="Continue" disabled={cacNumber.trim().length < 8} loading={save.isPending} onPress={() => save.mutate()} />
    </StepFrame>
  );
}

const styles = StyleSheet.create({ chips: { flexDirection: "row", flexWrap: "wrap", gap: 12 } });
