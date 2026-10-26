"use client";

import { SearchableMultiSelect, type MultiSelectOption } from "@/components/ui/searchableMultiSelect";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { audiencesApi } from "@/services/audiencesApi.service";
import type { AudienceSpec, CustomAudience } from "@/types/audience.type";
import { formatRangeOfPeople } from "@/utils/numberFormatting.util";

import styles from "./audienceBuilder.module.css";

const customAudienceTypeLabels: Record<CustomAudience["type"], string> = {
  store_customers: "Store customers",
  engagers: "Engagers",
  followers: "Followers",
  customer_list: "Customer list",
  lookalike: "Lookalike",
};

function convertCustomAudienceToOption(audience: CustomAudience): MultiSelectOption {
  const statusNote = audience.status === "ready" ? formatRangeOfPeople(audience.approximateSize) : audience.status.replace("_", " ");
  return { value: audience.id, label: audience.name, detail: `${customAudienceTypeLabels[audience.type]} · ${statusNote}` };
}

function pickOptionsByIds(options: readonly MultiSelectOption[], ids: readonly string[]): MultiSelectOption[] {
  return ids.map((id) => options.find((option) => option.value === id) ?? { value: id, label: id });
}

export function AudienceInterestFields({ accountId, audience, onAudienceChange, customAudienceError }: { readonly accountId: string; readonly audience: AudienceSpec; readonly onAudienceChange: (audience: AudienceSpec) => void; readonly customAudienceError?: string }) {
  const topicsQuery = useAdsQuery(() => audiencesApi.listTopics(), "topics");
  const behavioursQuery = useAdsQuery(() => audiencesApi.listBehaviours(), "behaviours");
  const customAudiencesQuery = useAdsQuery(() => audiencesApi.listCustomAudiences(accountId), `custom-audiences-${accountId}`);
  const topicOptions = (topicsQuery.data ?? []).map((topic) => ({ value: topic.id, label: topic.name }));
  const behaviourOptions = (behavioursQuery.data?.items ?? []).map((behaviour) => ({ value: behaviour.id, label: behaviour.name, detail: behaviour.description }));
  const customOptions = (customAudiencesQuery.data?.items ?? []).map(convertCustomAudienceToOption);
  const readIds = (options: readonly MultiSelectOption[]) => options.map((option) => option.value);
  return (
    <div className={styles.stack}>
      <SearchableMultiSelect label="Interests and topics" placeholder="e.g. Fashion, Sneakers, Owambe" options={topicOptions} selectedOptions={pickOptionsByIds(topicOptions, audience.topicIds)} onSelectedOptionsChange={(options) => onAudienceChange({ ...audience, topicIds: readIds(options) })} isLoading={topicsQuery.isLoading} hint="People who follow or engage with these topics on Nantty." />
      <SearchableMultiSelect label="Behaviours" placeholder="e.g. Frequent buyers" options={behaviourOptions} selectedOptions={pickOptionsByIds(behaviourOptions, audience.behaviourIds)} onSelectedOptionsChange={(options) => onAudienceChange({ ...audience, behaviourIds: readIds(options) })} isLoading={behavioursQuery.isLoading} />
      <SearchableMultiSelect label="Include custom audiences and lookalikes" placeholder="Store customers, engagers, lookalikes…" options={customOptions} selectedOptions={pickOptionsByIds(customOptions, audience.customAudienceIds)} onSelectedOptionsChange={(options) => onAudienceChange({ ...audience, customAudienceIds: readIds(options) })} isLoading={customAudiencesQuery.isLoading} />
      <SearchableMultiSelect label="Exclude custom audiences" placeholder="e.g. people who already bought" tone="exclude" options={customOptions} selectedOptions={pickOptionsByIds(customOptions, audience.excludedCustomAudienceIds)} onSelectedOptionsChange={(options) => onAudienceChange({ ...audience, excludedCustomAudienceIds: readIds(options) })} isLoading={customAudiencesQuery.isLoading} />
      {customAudienceError ? (
        <p className={styles.error} role="alert">
          {customAudienceError}
        </p>
      ) : null}
    </div>
  );
}
