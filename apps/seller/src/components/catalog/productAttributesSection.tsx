"use client";

import { createDraftKey, type AttributeDraft } from "@/components/catalog/productEditorDraft.util";
import { Button, IconButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { maximumProductAttributes } from "@/utils/productValidation.util";

import styles from "./productEditor.module.css";

const suggestedAttributeNames = ["Material", "Made in", "Care", "Dimensions", "Weight", "Warranty", "Size guide"];

export function ProductAttributesSection({ attributes, fieldErrors, onAttributesChange }: { readonly attributes: AttributeDraft[]; readonly fieldErrors: Record<string, string>; readonly onAttributesChange: (attributes: AttributeDraft[]) => void }) {
  const updateAttribute = (key: string, patch: Partial<AttributeDraft>) => onAttributesChange(attributes.map((attribute) => (attribute.key === key ? { ...attribute, ...patch } : attribute)));
  const usedNames = new Set(attributes.map((attribute) => attribute.name.trim().toLowerCase()));
  return (
    <Panel
      title="Attributes"
      description="Facts buyers look for, shown as a list on the product page."
      actions={attributes.length < maximumProductAttributes ? <Button size="small" iconName="plus16" onClick={() => onAttributesChange([...attributes, { key: createDraftKey(), name: "", value: "" }])}>Add attribute</Button> : null}
    >
      {attributes.length === 0 ? (
        <div className={styles.suggestionRow}>
          {suggestedAttributeNames.map((name) => (
            <Button key={name} size="small" variant="ghost" onClick={() => onAttributesChange([...attributes, { key: createDraftKey(), name, value: "" }])}>+ {name}</Button>
          ))}
        </div>
      ) : (
        <ul className={styles.attributeList}>
          {attributes.map((attribute, index) => (
            <li key={attribute.key} className={styles.attributeRow}>
              <input className={styles.cellInput} aria-label={`Attribute ${index + 1} name`} placeholder="Name, e.g. Material" value={attribute.name} maxLength={40} aria-invalid={fieldErrors[`attributes.${index}.name`] ? true : undefined} onChange={(event) => updateAttribute(attribute.key, { name: event.target.value })} />
              <input className={styles.cellInput} aria-label={`Attribute ${index + 1} value`} placeholder="Value, e.g. 100% cotton" value={attribute.value} maxLength={200} aria-invalid={fieldErrors[`attributes.${index}.value`] ? true : undefined} onChange={(event) => updateAttribute(attribute.key, { value: event.target.value })} />
              <IconButton iconName="trash24" label={`Remove attribute ${attribute.name || index + 1}`} size="small" onClick={() => onAttributesChange(attributes.filter((candidate) => candidate.key !== attribute.key))} />
            </li>
          ))}
        </ul>
      )}
      {attributes.length > 0 ? (
        <div className={styles.suggestionRow}>
          {suggestedAttributeNames.filter((name) => !usedNames.has(name.toLowerCase())).slice(0, 4).map((name) => (
            <Button key={name} size="small" variant="ghost" onClick={() => onAttributesChange([...attributes, { key: createDraftKey(), name, value: "" }])}>+ {name}</Button>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
