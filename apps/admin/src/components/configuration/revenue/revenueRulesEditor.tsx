import { NoticeBanner } from "@/components/ui/feedback";
import { SelectField, TextAreaField } from "@/components/ui/formFields";
import { Card } from "@/components/ui/surfaces";
import type { RevenueRulesConfiguration } from "@/types/platformConfiguration.type";
import { formatBasisPointsAsPercent } from "@/utils/formatting.util";

import { BasisPointsField, MoneyPerCurrencyEditor } from "../shared/configurationFields";
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
            <BasisPointsField label="Coin transfer fee" hint="Taken by Nantty when coins move between people." basisPoints={rules.coinTransferFeeBasisPoints} maximumBasisPoints={5000} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, coinTransferFeeBasisPoints: value }))} />
          </div>
          <MoneyPerCurrencyEditor label="Value of one coin" amounts={rules.coinUnitValues} supportedCurrencies={currencies} isDisabled={isDisabled} onChange={(coinUnitValues) => onChange((current) => ({ ...current, coinUnitValues }))} />
        </Card>
        <Card title="Escrow fee">
          <div className={styles.grid}>
            <BasisPointsField label="Escrow fee (Free and Pro)" hint="Paid by the seller on escrow orders, including shipping. Nantty takes no commission on products." basisPoints={rules.escrowFee.defaultBasisPoints} maximumBasisPoints={500} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, escrowFee: { ...current.escrowFee, defaultBasisPoints: value } }))} />
            <BasisPointsField label="Escrow fee (Business plan)" basisPoints={rules.escrowFee.businessPlanBasisPoints} maximumBasisPoints={500} isDisabled={isDisabled} onChange={(value) => onChange((current) => ({ ...current, escrowFee: { ...current.escrowFee, businessPlanBasisPoints: value } }))} />
          </div>
          <NoticeBanner tone="info">Direct payments from verified stores carry no Nantty fee. The seller covers only the payment processing fee.</NoticeBanner>
        </Card>
        <Card title="Withdrawal fee">
          <SelectField label="How the fee is set" value={rules.withdrawalFee.mode} disabled options={[{ value: "PASS_THROUGH", label: "Pass through the payment provider's fee" }]} />
          <NoticeBanner tone="info">The fee is whatever the payment partner charges for the transfer, shown to the person before they confirm. Nantty adds no margin.</NoticeBanner>
          <TextAreaField label="Note shown to sellers and creators" value={rules.withdrawalFee.note} rows={2} maxLength={300} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, withdrawalFee: { ...current.withdrawalFee, note: event.target.value } }))} />
        </Card>
      </div>
      <div className={styles.column}>
        <RevenueEffectPreview rules={rules} />
      </div>
    </div>
  );
}
