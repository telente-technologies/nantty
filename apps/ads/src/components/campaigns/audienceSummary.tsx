"use client";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { audiencesApi } from "@/services/audiencesApi.service";
import type { AudienceSpec } from "@/types/audience.type";

import styles from "./detailPages.module.css";

function ChipGroup({ label, values, isExcluded = false }: { readonly label: string; readonly values: readonly string[]; readonly isExcluded?: boolean }) {
  if (values.length === 0) return null;
  return (
    <div className={styles.fieldGroup}>
      <span className={styles.fieldLabel}>{label}</span>
      <ul className={styles.chipList}>
        {values.map((value) => (
          <li key={value} className={isExcluded ? `${styles.chip} ${styles.excludedChip}` : styles.chip}>
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

const genderLabels = { all: "All genders", female: "Women", male: "Men" } as const;

export function AudienceSummary({ audience }: { readonly audience: AudienceSpec }) {
  const { accountId } = useAdAccount();
  const namesQuery = useAdsQuery(
    async () => {
      const [topics, behaviours, customAudiences] = await Promise.all([audiencesApi.listTopics(), audiencesApi.listBehaviours(), audiencesApi.listCustomAudiences(accountId)]);
      return {
        topicNames: new Map(topics.map((topic) => [topic.id, topic.name])),
        behaviourNames: new Map(behaviours.items.map((behaviour) => [behaviour.id, behaviour.name])),
        customAudienceNames: new Map(customAudiences.items.map((customAudience) => [customAudience.id, customAudience.name])),
      };
    },
    accountId,
  );
  const names = namesQuery.data;
  const lookUp = (ids: readonly string[], map: ReadonlyMap<string, string> | undefined) => ids.map((id) => map?.get(id) ?? id);
  return (
    <div>
      <ChipGroup label="Locations" values={audience.locations.map((location) => (location.parentName ? `${location.name}, ${location.parentName}` : location.name))} />
      <ChipGroup label="Excluded locations" values={audience.excludedLocations.map((location) => location.name)} isExcluded />
      <ChipGroup label="Age and gender" values={[`${audience.ageMin}–${audience.ageMax === 65 ? "65+" : audience.ageMax}`, genderLabels[audience.gender]]} />
      <ChipGroup label="Interests" values={lookUp(audience.topicIds, names?.topicNames)} />
      <ChipGroup label="Behaviours" values={lookUp(audience.behaviourIds, names?.behaviourNames)} />
      <ChipGroup label="Custom audiences" values={lookUp(audience.customAudienceIds, names?.customAudienceNames)} />
      <ChipGroup label="Excluded audiences" values={lookUp(audience.excludedCustomAudienceIds, names?.customAudienceNames)} isExcluded />
    </div>
  );
}
