"use client";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { CheckboxField } from "@/components/ui/formFields";
import { configurationDocumentEndpoint } from "@/services/configurationApi.service";
import type { AppStoreFeeSettings } from "@/types/platformConfiguration.type";

import { BasisPointsField } from "../shared/configurationFields";
import { VersionedDocumentSection } from "../shared/versionedDocumentSection";
import styles from "./regionalPricing.module.css";

const appStoreFeesEndpoint = configurationDocumentEndpoint<"appStore.fees">();
const maximumStoreFeeBps = 5_000;

export function AppStoreFeesPanel() {
  const { can } = useAdminPermissions();
  return (
    <VersionedDocumentSection<AppStoreFeeSettings>
      endpoint={appStoreFeesEndpoint}
      recordId="appStore.fees"
      title="App store fees"
      canWrite={can("config:revenue")}
      renderEditor={(content, updateContent, canWrite) => (
        <div className={styles.sections}>
          <p className={styles.note}>What Apple and Google keep from in-app purchases and subscriptions. The fee is booked as an expense when a store purchase settles and is taken out before creator and seller shares. Saving asks for your authenticator code.</p>
          <div className={styles.fieldGrid}>
            <BasisPointsField label="Apple fee" hint="Standard App Store commission." basisPoints={content.appleFeeBps} maximumBasisPoints={maximumStoreFeeBps} isDisabled={!canWrite} onChange={(appleFeeBps) => updateContent((current) => ({ ...current, appleFeeBps }))} />
            <BasisPointsField label="Apple small business fee" hint="Used instead while the small business program is on." basisPoints={content.appleSmallBusinessFeeBps} maximumBasisPoints={maximumStoreFeeBps} isDisabled={!canWrite} onChange={(appleSmallBusinessFeeBps) => updateContent((current) => ({ ...current, appleSmallBusinessFeeBps }))} />
            <BasisPointsField label="Google fee" hint="Google Play subscription commission." basisPoints={content.googleSubscriptionFeeBps} maximumBasisPoints={maximumStoreFeeBps} isDisabled={!canWrite} onChange={(googleSubscriptionFeeBps) => updateContent((current) => ({ ...current, googleSubscriptionFeeBps }))} />
          </div>
          <CheckboxField label="Apple small business program" description="Turn on once Apple confirms Zudomart is enrolled in the App Store Small Business Program." checked={content.appleSmallBusinessProgram} disabled={!canWrite} onChange={(event) => updateContent((current) => ({ ...current, appleSmallBusinessProgram: event.target.checked }))} />
        </div>
      )}
    />
  );
}
