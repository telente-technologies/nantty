import { NoticeBanner } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextAreaField } from "@/components/ui/formFields";
import { Card } from "@/components/ui/surfaces";
import type { RevenueRulesConfiguration } from "@/types/platformConfiguration.type";
import { formatBasisPointsAsPercent } from "@/utils/formatting.util";

import { BasisPointsField, MoneyPerCurrencyEditor, WholeNumberField } from "../shared/configurationFields";
import { CommissionOverridesEditor } from "./commissionOverridesEditor";
import { RevenueEffectPreview } from "./revenueEffectPreview";
import styles from "./revenueRules.module.css";

interface RevenueRulesEditorProps {
  readonly rules: RevenueRulesConfiguration;
  readonly canWrite: boolean;
  readonly onChange: (updater: (current: RevenueRulesConfiguration) => RevenueRulesConfiguration) => void;
}

export function RevenueRulesEditor({ rules, canWrite, onChange }: RevenueRulesEditorProps) {
  const isDisabled = !canWrite;
  const currencies = rules.supportedCurrencies;
  return (
    <div className={styles.layout}>
      <div className={styles.column}>
        <Card title="Creators and coins">
          <div className={styles.grid}>
            <BasisPointsField label="Creator share of ad revenue" hint="Paid on ads shown on the creator's content." basisPoints={rules.creatorAdShareBasisPoints} maximumBasisPoints={9000} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, creatorAdShareBasisPoints: value }))} />
            <BasisPointsField label="Creator share of gifts" hint={`Cannot exceed ${formatBasisPointsAsPercent(rules.giftCreatorShareCeilingBasisPoints)}.`} basisPoints={rules.giftCreatorShareBasisPoints} maximumBasisPoints={rules.giftCreatorShareCeilingBasisPoints} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, giftCreatorShareBasisPoints: value }))} />
            <BasisPointsField label="Coin transfer fee" hint="Taken by Zudomart when coins move between people." basisPoints={rules.coinTransferFeeBasisPoints} maximumBasisPoints={5000} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, coinTransferFeeBasisPoints: value }))} />
          </div>
          <MoneyPerCurrencyEditor label="Value of one coin" amounts={rules.coinUnitValues} supportedCurrencies={currencies} isDisabled={isDisabled} onChange={(coinUnitValues) => onChange((current) => ({ ...current, coinUnitValues }))} />
        </Card>
        <Card title="Marketplace commission">
          <div className={styles.grid}>
            <BasisPointsField label="Default commission" basisPoints={rules.marketplaceCommission.defaultBasisPoints} maximumBasisPoints={3000} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, marketplaceCommission: { ...current.marketplaceCommission, defaultBasisPoints: value } }))} />
          </div>
          <CommissionOverridesEditor overrides={rules.marketplaceCommission.categoryOverrides} canWrite={canWrite} onChange={(categoryOverrides) => onChange((current) => ({ ...current, marketplaceCommission: { ...current.marketplaceCommission, categoryOverrides } }))} />
        </Card>
        <Card title="Withdrawal fee">
          <SelectField label="How the fee is set" value={rules.withdrawalFee.mode} disabled options={[{ value: "PASS_THROUGH", label: "Pass through the payment provider's fee" }]} />
          <NoticeBanner tone="info">The fee is whatever Paystack or Flutterwave charges for the transfer, shown to the person before they confirm. Zudomart adds no margin.</NoticeBanner>
          <TextAreaField label="Note shown to sellers and creators" value={rules.withdrawalFee.note} rows={2} maxLength={300} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, withdrawalFee: { ...current.withdrawalFee, note: event.target.value } }))} />
        </Card>
      </div>
      <div className={styles.column}>
        <RevenueEffectPreview rules={rules} />
        <Card title="Loyalty points">
          <CheckboxField label="Loyalty points are on" checked={rules.loyalty.isEnabled} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, loyalty: { ...current.loyalty, isEnabled: event.target.checked } }))} />
          <div className={styles.grid}>
            <WholeNumberField label="Points per whole unit spent" value={rules.loyalty.pointsPerMajorUnitSpent} maximum={100} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, loyalty: { ...current.loyalty, pointsPerMajorUnitSpent: value } }))} />
            <WholeNumberField label="Points expire after (days)" value={rules.loyalty.pointExpiryDays} minimum={30} maximum={1095} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, loyalty: { ...current.loyalty, pointExpiryDays: value } }))} />
          </div>
        </Card>
        <Card title="Cashback">
          <CheckboxField label="Cashback is on" checked={rules.cashback.isEnabled} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, cashback: { ...current.cashback, isEnabled: event.target.checked } }))} />
          <div className={styles.grid}>
            <BasisPointsField label="Cashback rate" basisPoints={rules.cashback.rateBasisPoints} maximumBasisPoints={2000} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, cashback: { ...current.cashback, rateBasisPoints: value } }))} />
            <WholeNumberField label="Cashback expires after (days)" value={rules.cashback.expiryDays} minimum={7} maximum={365} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, cashback: { ...current.cashback, expiryDays: value } }))} />
          </div>
          <MoneyPerCurrencyEditor label="Maximum cashback per order" amounts={rules.cashback.capsPerOrder} supportedCurrencies={currencies} isDisabled={isDisabled} onChange={(capsPerOrder) => onChange((current) => ({ ...current, cashback: { ...current.cashback, capsPerOrder } }))} />
        </Card>
        <Card title="Referrals">
          <CheckboxField label="Referral rewards are on" checked={rules.referral.isEnabled} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, referral: { ...current.referral, isEnabled: event.target.checked } }))} />
          <WholeNumberField label="Maximum rewarded referrals per person per month" value={rules.referral.maximumReferralsPerMonth} maximum={1000} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, referral: { ...current.referral, maximumReferralsPerMonth: value } }))} />
          <MoneyPerCurrencyEditor label="Reward for the person who invites" amounts={rules.referral.referrerRewards} supportedCurrencies={currencies} isDisabled={isDisabled} onChange={(referrerRewards) => onChange((current) => ({ ...current, referral: { ...current.referral, referrerRewards } }))} />
          <MoneyPerCurrencyEditor label="Reward for the new person" amounts={rules.referral.refereeRewards} supportedCurrencies={currencies} isDisabled={isDisabled} onChange={(refereeRewards) => onChange((current) => ({ ...current, referral: { ...current.referral, refereeRewards } }))} />
          <MoneyPerCurrencyEditor label="First order must be at least" amounts={rules.referral.qualifyingOrderMinimums} supportedCurrencies={currencies} isDisabled={isDisabled} onChange={(qualifyingOrderMinimums) => onChange((current) => ({ ...current, referral: { ...current.referral, qualifyingOrderMinimums } }))} />
        </Card>
      </div>
    </div>
  );
}
