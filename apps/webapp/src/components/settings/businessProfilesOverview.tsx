import Link from "next/link";

import { Badge } from "@/components/ui/feedback";
import type { LinkedProfiles } from "@/types/brand.type";
import { describeBusinessProfileAllowance, describeBusinessProfileAllowanceNotice, readBusinessProfileAllowanceState, shouldShowStoreBadge, STORE_BADGE_TEXT } from "@/utils/businessProfileAllowance.util";
import { LINKED_KIND_LABELS } from "@/utils/linkedProfiles.util";

import styles from "./settings.module.css";
import profileStyles from "./businessProfiles.module.css";

export function BusinessProfilesOverview({ linked }: { readonly linked: LinkedProfiles }) {
  const allowance = linked.businessProfiles;
  const allowanceState = allowance ? readBusinessProfileAllowanceState(allowance) : "available";
  const notice = allowance ? describeBusinessProfileAllowanceNotice(allowance) : null;
  const profiles = linked.items.filter((item) => item.status !== "retired");
  const canCreateNonSelling = linked.canCreate.business || linked.canCreate.brand;
  return (
    <>
      <section aria-labelledby="business-profiles-heading" className={styles.block}>
        <h2 id="business-profiles-heading" className={styles.blockHeading}>Your business profiles</h2>
        {allowance ? <p className={profileStyles.allowance}>{describeBusinessProfileAllowance(allowance)}</p> : null}
        <p className={styles.muted}>You can own one store. Your other businesses can be Business pages or Brands, which don&apos;t sell in Mart.</p>
        {profiles.length > 0 ? (
          <ul className={profileStyles.profileList}>
            {profiles.map((item) => (
              <li key={item.profileId} className={profileStyles.profileRow}>
                <span className={profileStyles.profileName}>
                  <span className={profileStyles.profileTitle}>{item.name || "Pending review"}</span>
                  <span className={styles.muted}>{LINKED_KIND_LABELS[item.kind]}{item.handle ? ` · @${item.handle}` : ""}</span>
                </span>
                {shouldShowStoreBadge(item) ? <Badge tone="brand">{STORE_BADGE_TEXT}</Badge> : null}
                {item.premiumNeeded ? <Badge tone="warning">Premium needed</Badge> : null}
                {item.status === "held" ? <Badge tone="neutral">On hold</Badge> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>You don&apos;t have any business profiles yet.</p>
        )}
      </section>
      <section aria-labelledby="add-business-profile-heading" className={styles.block}>
        <h2 id="add-business-profile-heading" className={styles.blockHeading}>Add a business profile</h2>
        {notice ? <p className={allowanceState === "premiumNeeded" ? styles.errorText : styles.muted} role="status">{notice}</p> : null}
        {allowanceState === "upgradeForMore" || allowanceState === "premiumNeeded" ? (
          <div className={styles.buttonRow}><Link href="/verification" className={styles.choiceChip}>See Blue Premium</Link></div>
        ) : null}
        {linked.canCreate.store ? (
          <>
            <p className={styles.muted}>A Store sells in Mart and shows the Mart icon.</p>
            <div className={styles.buttonRow}><Link href="/seller/apply" className={styles.choiceChip}>Open a store</Link></div>
          </>
        ) : null}
        {canCreateNonSelling ? <p className={styles.muted}>Business pages and Brands are created in the Nantty app.</p> : null}
        {!notice && !linked.canCreate.store && !canCreateNonSelling ? <p className={styles.muted}>You can&apos;t add another business profile right now.</p> : null}
      </section>
    </>
  );
}
