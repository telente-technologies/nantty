"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { adsHubService } from "@/services/adsHub.service";
import { authService } from "@/services/auth.service";
import type { BoostAudience, BoostAudienceGender, BoostEstimate } from "@/types/boost.type";
import { audienceIssue, MAXIMUM_AGE, MINIMUM_AGE } from "@/utils/adsHub.util";

import styles from "./adsHub.module.css";

type CustomAudience = Extract<BoostAudience, { mode: "custom" }>;

const GENDERS: readonly { readonly value: BoostAudienceGender; readonly label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "female", label: "Women" },
  { value: "male", label: "Men" },
];

const toggle = (values: readonly string[], value: string) => (values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);
const chipClass = (active: boolean) => [styles.chip, active ? styles.chipActive : ""].filter(Boolean).join(" ");

interface CreateAdAudienceStepProps {
  readonly audience: BoostAudience;
  readonly defaultCountryCode: string;
  readonly estimate: BoostEstimate | undefined;
  readonly estimateLoading: boolean;
  readonly onChange: (audience: BoostAudience) => void;
}

export function CreateAdAudienceStep({ audience, defaultCountryCode, estimate, estimateLoading, onChange }: CreateAdAudienceStepProps) {
  const custom: CustomAudience = audience.mode === "custom" ? audience : { mode: "custom", countryCode: defaultCountryCode, states: [], topicIds: [], gender: "all", ageMin: MINIMUM_AGE, ageMax: MAXIMUM_AGE };
  const issue = audienceIssue(audience);
  return (
    <section className={styles.section} aria-label="Audience">
      <h2 className={styles.sectionTitle}>Who should see it?</h2>
      <div className={styles.options} role="radiogroup" aria-label="Audience type">
        <button type="button" role="radio" aria-checked={audience.mode === "automatic"} className={[styles.option, audience.mode === "automatic" ? styles.optionSelected : ""].filter(Boolean).join(" ")} onClick={() => onChange({ mode: "automatic" })}>
          <span className={styles.optionTitle}>Automatic</span>
          <span className={styles.optionHint}>We show it to people likely to be interested, like people similar to your followers.</span>
        </button>
        <button type="button" role="radio" aria-checked={audience.mode === "custom"} className={[styles.option, audience.mode === "custom" ? styles.optionSelected : ""].filter(Boolean).join(" ")} onClick={() => onChange(custom)}>
          <span className={styles.optionTitle}>Choose my audience</span>
          <span className={styles.optionHint}>Pick a location, ages, gender and interests.</span>
        </button>
      </div>
      {audience.mode === "custom" ? <CustomAudienceFields audience={audience} onChange={onChange} /> : null}
      {issue ? <p className={styles.error} role="alert">{issue}</p> : null}
      <div className={styles.card} aria-live="polite">
        <span className={styles.label}>Estimated reach</span>
        {estimate ? (
          <>
            <span className={styles.metricValue}>{estimate.estimatedReachMin.toLocaleString()}–{estimate.estimatedReachMax.toLocaleString()} people</span>
            <span className={styles.rowMeta}>{estimate.estimatedResultsLabel}</span>
          </>
        ) : (
          <span className={styles.rowMeta}>{estimateLoading ? "Estimating…" : "Set a budget to see your estimated reach."}</span>
        )}
      </div>
    </section>
  );
}

function CustomAudienceFields({ audience, onChange }: { readonly audience: CustomAudience; readonly onChange: (audience: BoostAudience) => void }) {
  const [stateSearch, setStateSearch] = useState("");
  const countries = useQuery({ queryKey: ["ads", "locations", "countries"], queryFn: () => adsHubService.searchAdLocations("", ""), staleTime: 300_000, retry: false });
  const states = useQuery({ queryKey: ["ads", "locations", audience.countryCode, stateSearch], queryFn: () => adsHubService.searchAdLocations(stateSearch, audience.countryCode), enabled: /^[A-Z]{2}$/.test(audience.countryCode), staleTime: 300_000, retry: false });
  const topics = useQuery({ queryKey: ["topics"], queryFn: () => authService.fetchPersonalizationTopics(), staleTime: 300_000, retry: false });
  const countryOptions = (countries.data?.data ?? []).filter((location) => location.type === "country");
  const hasCountry = countryOptions.some((country) => country.code === audience.countryCode);
  const stateOptions = (states.data?.data ?? []).filter((location) => location.type === "state");
  const selectedTopicIds = audience.topicIds ?? [];
  return (
    <div className={styles.card}>
      <label className={styles.field}>
        Country
        <select className={styles.select} value={audience.countryCode} onChange={(event) => onChange({ ...audience, countryCode: event.target.value, states: [] })}>
          {!hasCountry ? <option value={audience.countryCode}>{audience.countryCode || "Choose a country"}</option> : null}
          {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select>
      </label>
      {countries.isError ? <p className={styles.note}>We couldn&apos;t load the country list.</p> : null}
      <div className={styles.section}>
        <label className={styles.field}>
          States or regions (optional)
          <input className={styles.input} type="search" value={stateSearch} onChange={(event) => setStateSearch(event.target.value)} placeholder="Search states" maxLength={80} />
        </label>
        <div className={styles.chips} role="group" aria-label="States">
          {audience.states.filter((code) => !stateOptions.some((state) => state.code === code)).map((code) => (
            <button key={code} type="button" className={chipClass(true)} aria-pressed onClick={() => onChange({ ...audience, states: toggle(audience.states, code) })}>{code}</button>
          ))}
          {stateOptions.map((state) => (
            <button key={state.code} type="button" className={chipClass(audience.states.includes(state.code))} aria-pressed={audience.states.includes(state.code)} onClick={() => onChange({ ...audience, states: toggle(audience.states, state.code) })}>{state.name}</button>
          ))}
        </div>
        <p className={styles.note}>{audience.states.length === 0 ? "Whole country." : `${audience.states.length} selected.`}</p>
      </div>
      <div className={styles.inlineFields}>
        <label className={styles.field}>
          From age
          <input className={styles.input} type="number" inputMode="numeric" min={MINIMUM_AGE} max={MAXIMUM_AGE} value={audience.ageMin} onChange={(event) => onChange({ ...audience, ageMin: Number(event.target.value) || MINIMUM_AGE })} />
        </label>
        <label className={styles.field}>
          To age
          <input className={styles.input} type="number" inputMode="numeric" min={MINIMUM_AGE} max={MAXIMUM_AGE} value={audience.ageMax} onChange={(event) => onChange({ ...audience, ageMax: Number(event.target.value) || MAXIMUM_AGE })} />
        </label>
      </div>
      <div className={styles.section}>
        <span className={styles.label}>Gender</span>
        <div className={styles.chips} role="group" aria-label="Gender">
          {GENDERS.map((gender) => (
            <button key={gender.value} type="button" className={chipClass((audience.gender ?? "all") === gender.value)} aria-pressed={(audience.gender ?? "all") === gender.value} onClick={() => onChange({ ...audience, gender: gender.value })}>{gender.label}</button>
          ))}
        </div>
      </div>
      <div className={styles.section}>
        <span className={styles.label}>Interests (optional, up to 20)</span>
        {topics.isError ? <p className={styles.note}>We couldn&apos;t load interests.</p> : null}
        <div className={styles.chips} role="group" aria-label="Interests">
          {(topics.data ?? []).map((topic) => {
            const selected = selectedTopicIds.includes(topic.id);
            return (
              <button key={topic.id} type="button" className={chipClass(selected)} aria-pressed={selected} disabled={!selected && selectedTopicIds.length >= 20} onClick={() => onChange({ ...audience, topicIds: toggle(selectedTopicIds, topic.id) })}>{topic.name}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
