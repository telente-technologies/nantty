import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { Chip } from "@/components/ui/chip";
import { ErrorState } from "@/components/ui/errorState";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { adsHubService } from "@/services/ads/adsHub.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { BoostAudience, BoostAudienceGender } from "@/types/boost.type";

const AGE_RANGES: readonly (readonly [number, number])[] = [[18, 65], [18, 24], [25, 34], [35, 44], [45, 65]];
const GENDERS: readonly { readonly value: BoostAudienceGender; readonly label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "female", label: "Women" },
  { value: "male", label: "Men" },
];
const MAXIMUM_TOPICS = 20;

type CustomAudience = Extract<BoostAudience, { mode: "custom" }>;

const toggleValue = (values: readonly string[], value: string): string[] => (values.includes(value) ? values.filter((existing) => existing !== value) : [...values, value]);

export function customAudienceDefaults(countryCode: string): CustomAudience {
  return { mode: "custom", countryCode, states: [], interests: [], ageMin: 18, ageMax: 65, gender: "all", topicIds: [] };
}

export interface CreateAdAudienceEditorProps {
  readonly audience: BoostAudience;
  readonly defaultCountryCode: string;
  readonly onChange: (audience: BoostAudience) => void;
}

export function CreateAdAudienceEditor({ audience, defaultCountryCode, onChange }: CreateAdAudienceEditorProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <SelectableRow selected={audience.mode === "automatic"} onPress={() => onChange({ mode: "automatic" })} accessibilityLabel="Automatic audience">
        <Text size={14} weight={500} lineHeight={16.8}>Automatic</Text>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>We show it to people likely to be interested in your country.</Text>
      </SelectableRow>
      <SelectableRow selected={audience.mode === "custom"} onPress={() => onChange(audience.mode === "custom" ? audience : customAudienceDefaults(defaultCountryCode))} accessibilityLabel="Choose your own audience">
        <Text size={14} weight={500} lineHeight={16.8}>Custom</Text>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>Pick location, age, gender and interests.</Text>
      </SelectableRow>
      {audience.mode === "custom" ? <CustomAudienceFields audience={audience} onChange={onChange} /> : null}
    </View>
  );
}

function CustomAudienceFields({ audience, onChange }: { readonly audience: CustomAudience; readonly onChange: (audience: BoostAudience) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [stateSearch, setStateSearch] = useState("");
  const countries = useQuery({ queryKey: ["ads", "locations", "countries"], queryFn: () => adsHubService.searchAdTargetingLocations("", ""), staleTime: 10 * 60_000 });
  const states = useQuery({
    queryKey: ["ads", "locations", audience.countryCode, stateSearch.trim().toLowerCase()],
    queryFn: () => adsHubService.searchAdTargetingLocations(stateSearch.trim(), audience.countryCode),
    staleTime: 5 * 60_000,
  });
  const topics = useQuery({ queryKey: ["ads", "topics"], queryFn: adsHubService.listAdTargetingTopics, staleTime: 10 * 60_000 });
  const topicIds = audience.topicIds ?? [];
  const countryOptions = (countries.data ?? []).filter((location) => location.type === "country");
  const stateOptions = (states.data ?? []).filter((location) => location.type === "state");
  const selectedStateNames = new Map((states.data ?? []).map((location) => [location.code, location.name]));
  return (
    <View style={styles.custom}>
      <Text size={13} weight={600} lineHeight={16.9}>Country</Text>
      <View style={styles.chips}>
        {(countryOptions.length > 0 ? countryOptions : [{ code: audience.countryCode, name: audience.countryCode }]).map((country) => (
          <Chip key={country.code} label={country.name} selected={audience.countryCode === country.code} onPress={() => onChange({ ...audience, countryCode: country.code, states: [] })} />
        ))}
      </View>
      <Text size={13} weight={600} lineHeight={16.9}>States or regions</Text>
      <TextField placeholder="Search states" value={stateSearch} onChangeText={setStateSearch} accessibilityLabel="Search states or regions" autoCorrect={false} />
      {states.isFetching && !states.data ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading places" /> : null}
      {states.isError ? <ErrorState error={states.error} message="Couldn't load places." variant="inline" onRetry={() => states.refetch()} /> : null}
      <View style={styles.chips}>
        {stateOptions.map((state) => (
          <Chip key={state.code} label={state.name} selected={audience.states.includes(state.code)} onPress={() => onChange({ ...audience, states: toggleValue(audience.states, state.code) })} />
        ))}
      </View>
      <Text size={12} lineHeight={16} color={colors.textMuted}>
        {audience.states.length === 0 ? "Whole country" : `${audience.states.length} selected: ${audience.states.map((code) => selectedStateNames.get(code) ?? code).join(", ")}`}
      </Text>
      <Text size={13} weight={600} lineHeight={16.9}>Age</Text>
      <View style={styles.chips}>
        {AGE_RANGES.map(([ageMin, ageMax]) => (
          <Chip key={`${ageMin}-${ageMax}`} label={ageMin === 18 && ageMax === 65 ? "All ages (18–65)" : `${ageMin}–${ageMax}`} selected={audience.ageMin === ageMin && audience.ageMax === ageMax} onPress={() => onChange({ ...audience, ageMin, ageMax })} />
        ))}
      </View>
      <Text size={13} weight={600} lineHeight={16.9}>Gender</Text>
      <View style={styles.chips}>
        {GENDERS.map((gender) => (
          <Chip key={gender.value} label={gender.label} selected={(audience.gender ?? "all") === gender.value} onPress={() => onChange({ ...audience, gender: gender.value })} />
        ))}
      </View>
      <Text size={13} weight={600} lineHeight={16.9}>Interests</Text>
      {topics.isError ? <ErrorState error={topics.error} message="Couldn't load interests." variant="inline" onRetry={() => topics.refetch()} /> : null}
      <View style={styles.chips}>
        {(topics.data ?? []).map((topic) => (
          <Chip
            key={topic.id}
            label={topic.name}
            selected={topicIds.includes(topic.id)}
            onPress={() => {
              if (!topicIds.includes(topic.id) && topicIds.length >= MAXIMUM_TOPICS) return;
              onChange({ ...audience, topicIds: toggleValue(topicIds, topic.id) });
            }}
          />
        ))}
      </View>
      <Text size={12} lineHeight={16} color={colors.textMuted}>{topicIds.length === 0 ? "No interests chosen: anyone in the location and age range." : `${topicIds.length} of ${MAXIMUM_TOPICS} interests chosen`}</Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 8 },
  custom: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
}));
