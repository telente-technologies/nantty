import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { payoutOnboardingService } from "@/services/payoutOnboarding.service";
import type { PayoutIdType, PayoutOnboardingState } from "@/types/payoutOnboarding.type";

import { StepFrame } from "./stepFrame";

interface IdentityStepProps {
  readonly state: PayoutOnboardingState;
  readonly stepCount: number;
  readonly onSaved: () => void;
}

export function IdentityStep({ state, stepCount, onSaved }: IdentityStepProps) {
  const { colors } = useTheme();
  const [legalName, setLegalName] = useState(state.legalName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [idType, setIdType] = useState<PayoutIdType>(state.idType ?? "bvn");
  const [idNumber, setIdNumber] = useState("");
  const [registeredBusiness, setRegisteredBusiness] = useState(state.requiresBusinessStep);
  const canSellFromBusiness = state.role !== "creator";

  const save = useMutation({
    mutationFn: () =>
      payoutOnboardingService.saveIdentity({ legalName: legalName.trim(), dateOfBirth, addressLine1: addressLine1.trim(), city: city.trim(), state: region.trim(), idType, idNumber, registeredBusiness }),
    onSuccess: onSaved,
  });
  const ready = legalName.trim() && dateOfBirth.length === 10 && addressLine1.trim() && city.trim() && region.trim() && idNumber.length === 11;

  return (
    <StepFrame
      stepNumber={1}
      stepCount={stepCount}
      title="Who you are"
      why="Nigerian banks and regulators require us to confirm who receives money before we can send it. We only ask once, and the same details cover everything you earn on Zudomart."
    >
      <TextField label="Legal name" placeholder="As it appears on your ID" value={legalName} onChangeText={setLegalName} autoCapitalize="words" textContentType="name" />
      <TextField label="Date of birth" placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} value={dateOfBirth} onChangeText={setDateOfBirth} />
      <TextField label="Home address" placeholder="Street and number" value={addressLine1} onChangeText={setAddressLine1} textContentType="streetAddressLine1" />
      <View style={styles.row}>
        <TextField label="City" value={city} onChangeText={setCity} style={styles.half} />
        <TextField label="State" value={region} onChangeText={setRegion} style={styles.half} />
      </View>
      <Text size={14} lineHeight={16.8}>ID to verify with</Text>
      <View style={styles.row}>
        <Chip kind="filter" label="BVN" selected={idType === "bvn"} onPress={() => setIdType("bvn")} />
        <Chip kind="filter" label="NIN" selected={idType === "nin"} onPress={() => setIdType("nin")} />
      </View>
      <TextField label={`${idType.toUpperCase()} (11 digits)`} keyboardType="number-pad" maxLength={11} value={idNumber} onChangeText={(value) => setIdNumber(value.replace(/\D/g, ""))} />
      {canSellFromBusiness ? (
        <>
          <Text size={14} lineHeight={16.8}>Do you sell as a registered business?</Text>
          <View style={styles.row}>
            <Chip kind="filter" label="No, as myself" selected={!registeredBusiness} onPress={() => setRegisteredBusiness(false)} />
            <Chip kind="filter" label="Yes, registered" selected={registeredBusiness} onPress={() => setRegisteredBusiness(true)} />
          </View>
        </>
      ) : null}
      <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
        Your BVN or NIN is used once to confirm your name matches your bank account. Zudomart never shows it again, shares it with other users, or uses it for anything else. We keep only the last 4 digits.
      </Text>
      {save.isError ? <Text size={12} lineHeight={14.4} color={colors.error}>{save.error.message}</Text> : null}
      <Button title="Continue" disabled={!ready} loading={save.isPending} onPress={() => save.mutate()} />
    </StepFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
});
