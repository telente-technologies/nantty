"use client";

import { TextField } from "@/components/ui/formFields";
import type { CreativeUtm } from "@/types/creative.type";
import { buildUtmUrl, isValidUtmValue } from "@/utils/adCreativeFormats.util";
import { isSafeHttpsUrl } from "@/utils/formValidation.util";

import styles from "./richFormatEditor.module.css";

const utmFields: readonly { readonly key: keyof CreativeUtm; readonly label: string; readonly placeholder: string }[] = [
  { key: "source", label: "UTM source", placeholder: "zudomart" },
  { key: "medium", label: "UTM medium", placeholder: "paid" },
  { key: "campaign", label: "UTM campaign", placeholder: "spring_launch" },
  { key: "content", label: "UTM content", placeholder: "carousel_1" },
];

interface UtmBuilderProps {
  readonly url: string;
  readonly utm: CreativeUtm;
  readonly onUtmChange: (utm: CreativeUtm) => void;
}

export function UtmBuilder({ url, utm, onUtmChange }: UtmBuilderProps) {
  const hasValues = Object.values(utm).some((value) => Boolean(value?.trim()));
  return (
    <fieldset className={styles.panel}>
      <legend className={styles.cardTitle}>Tracking parameters (optional)</legend>
      <div className={styles.twoColumns}>
        {utmFields.map((field) => {
          const value = utm[field.key] ?? "";
          return <TextField key={field.key} label={field.label} placeholder={field.placeholder} value={value} maxLength={60} error={isValidUtmValue(value) ? undefined : "Use letters, numbers, dashes or underscores."} onValueChange={(next) => onUtmChange({ ...utm, [field.key]: next })} />;
        })}
      </div>
      {hasValues && isSafeHttpsUrl(url) ? <p className={styles.destinationPreview}>People will land on {buildUtmUrl(url, utm)}</p> : <p className={styles.muted}>Missing source and medium default to zudomart and paid when you fill any field.</p>}
    </fieldset>
  );
}

interface CardDestinationProps {
  readonly destinationUrl: string;
  readonly onUrlChange: (url: string) => void;
  readonly error?: string;
}

export function CardDestinationField({ destinationUrl, onUrlChange, error }: CardDestinationProps) {
  return <TextField label="Card link" type="url" placeholder="https://" value={destinationUrl} onValueChange={onUrlChange} error={error} hint="Where this card leads. Only secure https:// links are allowed." />;
}
