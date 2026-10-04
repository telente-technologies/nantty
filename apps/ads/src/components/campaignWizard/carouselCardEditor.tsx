"use client";

import { CardDestinationField } from "@/components/campaignWizard/destinationFields";
import { CreativeUploadField } from "@/components/campaignWizard/creativeUploadField";
import { createEmptyCardDraft, type WizardCardDraft } from "@/components/campaignWizard/campaignWizardState.store";
import type { WizardFieldErrors } from "@/components/campaignWizard/campaignWizardValidation.util";
import { SelectField, TextField } from "@/components/ui/formFields";
import { callToActionLabels } from "@/constants/campaignOptions.constant";
import type { CallToAction } from "@/types/creative.type";
import { cardDescriptionMaximumLength, moveItem, cardHeadlineMaximumLength, maximumCarouselCards, minimumCarouselCards } from "@/utils/adCreativeFormats.util";

import styles from "./richFormatEditor.module.css";

interface CarouselCardEditorProps {
  readonly accountId: string;
  readonly cards: readonly WizardCardDraft[];
  readonly errors: WizardFieldErrors;
  readonly errorPrefix: string;
  readonly onCardsChange: (cards: WizardCardDraft[]) => void;
}

export function CarouselCardEditor({ accountId, cards, errors, errorPrefix, onCardsChange }: CarouselCardEditorProps) {
  const errorFor = (field: string) => errors[`${errorPrefix}.${field}`];
  const updateCard = (key: string, changes: Partial<Omit<WizardCardDraft, "key">>) => onCardsChange(cards.map((card) => (card.key === key ? { ...card, ...changes } : card)));
  return (
    <div className={styles.panel}>
      <p className={styles.cardTitle}>Cards ({cards.length} of {maximumCarouselCards})</p>
      <p className={styles.muted}>Add {minimumCarouselCards} to {maximumCarouselCards} cards. People swipe sideways through them in the order shown here.</p>
      {errorFor("cards") ? <p className={styles.error} role="alert">{errorFor("cards")}</p> : null}
      <ol className={styles.cardList}>
        {cards.map((card, index) => (
          <li key={card.key} className={styles.cardItem}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Card {index + 1}</span>
              <div className={styles.cardTools}>
                <button type="button" className={styles.toolButton} disabled={index === 0} aria-label={`Move card ${index + 1} earlier`} onClick={() => onCardsChange(moveItem(cards, index, -1))}>Earlier</button>
                <button type="button" className={styles.toolButton} disabled={index === cards.length - 1} aria-label={`Move card ${index + 1} later`} onClick={() => onCardsChange(moveItem(cards, index, 1))}>Later</button>
                <button type="button" className={styles.toolButton} aria-label={`Remove card ${index + 1}`} onClick={() => onCardsChange(cards.filter((candidate) => candidate.key !== card.key))}>Remove</button>
              </div>
            </div>
            <CreativeUploadField accountId={accountId} uploadedMedia={card.media ? [card.media] : []} onUploadedMediaChange={(media) => updateCard(card.key, { media: media[media.length - 1] ?? null })} error={errorFor(`cards.${index}.mediaId`)} />
            <TextField label="Headline" value={card.headline} maxLength={cardHeadlineMaximumLength} onValueChange={(headline) => updateCard(card.key, { headline })} error={errorFor(`cards.${index}.headline`)} hint={`${card.headline.length}/${cardHeadlineMaximumLength}`} />
            <TextField label="Description (optional)" value={card.description} maxLength={cardDescriptionMaximumLength} onValueChange={(description) => updateCard(card.key, { description })} error={errorFor(`cards.${index}.description`)} />
            <SelectField label="Button" value={card.callToAction} options={(Object.keys(callToActionLabels) as CallToAction[]).map((value) => ({ value, label: callToActionLabels[value] }))} onValueChange={(callToAction) => updateCard(card.key, { callToAction })} />
            <CardDestinationField destinationUrl={card.destinationUrl} onUrlChange={(destinationUrl) => updateCard(card.key, { destinationUrl })} error={errorFor(`cards.${index}.destination.url`)} />
          </li>
        ))}
      </ol>
      <button type="button" className={`${styles.toolButton} ${styles.addButton}`} disabled={cards.length >= maximumCarouselCards} onClick={() => onCardsChange([...cards, createEmptyCardDraft()])}>
        Add card
      </button>
    </div>
  );
}
