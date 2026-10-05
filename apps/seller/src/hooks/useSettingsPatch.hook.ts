"use client";

import { useCallback, useState } from "react";

import { useToast } from "@/components/ui/toastProvider";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { StoreSettings } from "@/types/store.type";
import { convertIssuesToFieldErrorMap } from "@/utils/formValidation.util";

export function useSettingsPatch() {
  const { reloadStoreContext } = useStoreContext();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  const saveStoreSettingsPatch = useCallback(
    async (patch: Partial<StoreSettings>, successMessage: string): Promise<boolean> => {
      setIsSaving(true);
      setServerFieldErrors({});
      try {
        const { storeRewards, ...settingsPatch } = patch;
        if (storeRewards) await sendSellerApiRequest("/seller/marketing/rewards/settings", { method: "PUT", body: storeRewards });
        if (Object.keys(settingsPatch).length > 0) await sendSellerApiRequest<StoreSettings>("/seller/settings", { method: "PATCH", body: settingsPatch });
        reloadStoreContext();
        showToast(successMessage);
        return true;
      } catch (error) {
        if (error instanceof SellerApiRequestError && error.issues && error.issues.length > 0) setServerFieldErrors(convertIssuesToFieldErrorMap(error.issues));
        showToast(readErrorMessageForDisplay(error), "error");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadStoreContext, showToast],
  );

  return { isSaving, serverFieldErrors, saveStoreSettingsPatch };
}
