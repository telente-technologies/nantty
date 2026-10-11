import { useMutation, useQueryClient } from "@tanstack/react-query";

import { SettingToggleRow } from "@/components/chatSafety/settingToggleRow";
import { useStepUpPrompt } from "@/components/wallet/stepUpSheet";
import { Text } from "@/components/ui/text";
import { describeActionFailure } from "@/errors/errorExperience/describeError";
import { linkedProfilesQueryKey } from "@/hooks/useLinkedProfiles.hook";
import { brandsService } from "@/services/sellers/brands.service";
import { useTheme } from "@/theme";
import type { BrandDetail } from "@/types/brand.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

const TURN_ON_COPY = "Your brand storefront and products will show in Mart. Selling uses your wallet, escrow in Nigeria, and identity verification before selling outside Nigeria.";
const TURN_OFF_COPY = "Your products and storefront will be hidden and you can't add new listings. Open orders and payouts carry on until they're complete.";

export function BrandSellingSwitch({ brand }: { readonly brand: BrandDetail }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { withStepUp, stepUpSheet } = useStepUpPrompt();
  const enabled = brand.sellingEnabled === true;
  const toggle = useMutation({
    mutationFn: (next: boolean) => withStepUp((token) => brandsService.setBrandSelling(brand.id, next, token)),
    onSuccess: (updated) => {
      queryClient.setQueryData(["brands", brand.id], updated);
      queryClient.invalidateQueries({ queryKey: ["brands", brand.id, "products"] });
      queryClient.invalidateQueries({ queryKey: linkedProfilesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["users", "me", "profiles"] });
    },
  });
  const confirm = (next: boolean) =>
    showAlertWithButtons(next ? "Sell products with this brand?" : "Stop selling with this brand?", next ? TURN_ON_COPY : TURN_OFF_COPY, [
      { text: "Cancel", style: "cancel" },
      { text: next ? "Turn on" : "Turn off", style: next ? "default" : "destructive", onPress: () => toggle.mutate(next) },
    ]);
  return (
    <>
      <SettingToggleRow label="Sell products with this brand" description={enabled ? "Selling is on. Your Mart icon and products tab are visible." : "Selling is off. This brand is a showcase only."} value={enabled} disabled={toggle.isPending} onValueChange={confirm} />
      {toggle.isError ? <Text size={12} color={colors.error} align="center">{describeActionFailure(toggle.error)}</Text> : null}
      {stepUpSheet}
    </>
  );
}
