"use client";

import { CreativeUploadField } from "@/components/campaignWizard/creativeUploadField";
import type { WizardAppDraft } from "@/components/campaignWizard/campaignWizardState.store";
import type { WizardFieldErrors } from "@/components/campaignWizard/campaignWizardValidation.util";
import { TextField } from "@/components/ui/formFields";

import styles from "./richFormatEditor.module.css";

interface AppInstallFieldsProps {
  readonly accountId: string;
  readonly app: WizardAppDraft;
  readonly errors: WizardFieldErrors;
  readonly errorPrefix: string;
  readonly onAppChange: (app: WizardAppDraft) => void;
}

export function AppInstallFields({ accountId, app, errors, errorPrefix, onAppChange }: AppInstallFieldsProps) {
  const errorFor = (field: string) => errors[`${errorPrefix}.${field}`];
  const set = (changes: Partial<WizardAppDraft>) => onAppChange({ ...app, ...changes });
  return (
    <div className={styles.panel}>
      <p className={styles.cardTitle}>App details</p>
      {errorFor("app") ? <p className={styles.error} role="alert">{errorFor("app")}</p> : null}
      <TextField label="App name" value={app.appName} maxLength={50} onValueChange={(appName) => set({ appName })} error={errorFor("app.appName")} />
      <div>
        <p className={styles.cardTitle}>App icon</p>
        <CreativeUploadField accountId={accountId} uploadedMedia={app.iconMedia ? [app.iconMedia] : []} onUploadedMediaChange={(media) => set({ iconMedia: media[media.length - 1] ?? null })} />
      </div>
      <TextField label="Store rating (optional)" inputMode="decimal" placeholder="4.6" value={app.ratingText} onValueChange={(ratingText) => set({ ratingText })} error={errorFor("app.rating")} hint="Between 1 and 5." />
      <TextField label="App Store link" type="url" placeholder="https://apps.apple.com/ng/app/your-app/id123" value={app.iosStoreUrl} onValueChange={(iosStoreUrl) => set({ iosStoreUrl })} error={errorFor("app.iosStoreUrl")} hint="Shown to people on iPhone and iPad." />
      <TextField label="Google Play link" type="url" placeholder="https://play.google.com/store/apps/details?id=com.example.app" value={app.androidStoreUrl} onValueChange={(androidStoreUrl) => set({ androidStoreUrl })} error={errorFor("app.androidStoreUrl")} hint="Shown to people on Android." />
      <TextField label="Web link for other devices" type="url" placeholder="https://" value={app.webFallbackUrl} onValueChange={(webFallbackUrl) => set({ webFallbackUrl })} error={errorFor("app.webFallbackUrl")} hint="Required when only one store link is set." />
      <div className={styles.twoColumns}>
        <TextField label="iOS deep link (optional)" placeholder="myapp://promo" value={app.iosDeepLink} onValueChange={(iosDeepLink) => set({ iosDeepLink })} error={errorFor("app.iosDeepLink")} />
        <TextField label="Android deep link (optional)" placeholder="myapp://promo" value={app.androidDeepLink} onValueChange={(androidDeepLink) => set({ androidDeepLink })} error={errorFor("app.androidDeepLink")} />
      </div>
      <p className={styles.muted}>People who already have the app open it through the deep link. Everyone else goes to their store.</p>
    </div>
  );
}
