"use client";

import { useState } from "react";

import { Panel } from "@/components/ui/panel";
import { MoneyField, SelectField } from "@/components/ui/formFields";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { nigeriaGeoStates } from "@/constants/nigeriaGeo.constant";
import type { ShippingProfile } from "@/types/shipping.type";
import { convertMajorInputToMinorUnits } from "@/utils/money.util";
import { calculateShippingForOrderGroup } from "@/utils/shippingCalculation.util";

import styles from "./shipping.module.css";

export function ShippingLivePreview({ profile }: { readonly profile: ShippingProfile }) {
  const { formatMoney } = useMoneyFormatter();
  const [stateCode, setStateCode] = useState("OG");
  const [lgaName, setLgaName] = useState("");
  const [totalText, setTotalText] = useState("30000");
  const geoState = nigeriaGeoStates.find((candidate) => candidate.code === stateCode);
  const orderTotalMinor = convertMajorInputToMinorUnits(totalText || "0", profile.currency);
  const orderTotal = { amountMinor: orderTotalMinor ?? 0, currency: profile.currency };
  const calculation = calculateShippingForOrderGroup(profile, { stateCode, lgaName: lgaName || null }, orderTotal);
  const destinationName = lgaName ? `${lgaName}, ${geoState?.name}` : geoState?.name;
  const sentenceByOutcome = {
    fee: `pays ${formatMoney(calculation.fee)} shipping`,
    free_rule: "gets free shipping",
    free_threshold: `gets free shipping (order is over ${formatMoney(calculation.thresholdApplied)})`,
    not_deliverable: "cannot check out: you do not ship there yet",
  } as const;

  return (
    <Panel title="Live preview" description="Try a destination and an order total to see what a customer would be charged.">
      <div className={styles.previewControls}>
        <SelectField label="State" value={stateCode} options={nigeriaGeoStates.map((state) => ({ value: state.code, label: state.name }))} onChange={(event) => { setStateCode(event.target.value); setLgaName(""); }} />
        <SelectField label="Local government area" value={lgaName} disabled={!geoState || geoState.localGovernmentAreas.length === 0} options={[{ value: "", label: "Any area" }, ...(geoState?.localGovernmentAreas ?? []).map((name) => ({ value: name, label: name }))]} onChange={(event) => setLgaName(event.target.value)} />
        <MoneyField label="Order total" currency={profile.currency} valueText={totalText} onValueTextChange={setTotalText} />
      </div>
      <p className={styles.previewSentence} aria-live="polite">
        A customer in <strong>{destinationName}</strong> ordering <strong>{formatMoney(orderTotal)}</strong> <strong>{sentenceByOutcome[calculation.outcome]}</strong>.
      </p>
      {calculation.zoneName ? <p className={styles.muted}>Rule applied: {calculation.zoneName} ({calculation.matchedLevel === "lga" ? "local government area" : calculation.matchedLevel}).</p> : null}
    </Panel>
  );
}
