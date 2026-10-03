import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { InfoSheet } from "@/components/settings/infoSheet";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import type { SavedCardDisplay } from "@/types/commerce.type";
import { readSavedCardDisplay, removeSavedCardFromThisDevice } from "@/utils/savedCard.util";
import type { MainScreenProps } from "@/navigation/navigation.types";

export function SettingsPaymentMethodsScreen({ navigation }: MainScreenProps<"SettingsPaymentMethods">) {
  const [cardInfoVisible, setCardInfoVisible] = useState(false);
  const [savedCard, setSavedCard] = useState<SavedCardDisplay | null>(null);
  useFocusEffect(
    useCallback(() => {
      void readSavedCardDisplay().then(setSavedCard);
    }, []),
  );
  const removeSavedCard = async () => {
    await removeSavedCardFromThisDevice();
    setSavedCard(null);
    setCardInfoVisible(false);
  };
  return (
    <SettingsPage title="Payment Methods">
      <SettingsGroup>
        <SettingsRow label="Card" trailing={savedCard ? { text: `${savedCard.brand} ${savedCard.last4}` } : "chevron"} onPress={() => setCardInfoVisible(true)} />
        <SettingsRow label="Wallets" onPress={() => navigation.navigate("Wallet")} />
        <SettingsRow label="Subscriptions" onPress={() => navigation.navigate("MySubscriptions")} />
        <SettingsRow label="Payout for Sellers" onPress={() => navigation.navigate("PayoutAccounts")} />
      </SettingsGroup>
      <InfoSheet
        visible={cardInfoVisible}
        title="Cards"
        message={
          savedCard
            ? `${savedCard.brand} ending ${savedCard.last4}, expires ${String(savedCard.expMonth).padStart(2, "0")}/${savedCard.expYear}. Saved on this device and unlocked with your fingerprint or face. Zudomart never stores your card number.`
            : "You pay securely in the Paystack payment window at checkout. Zudomart never stores your card number. You can choose to save a card on this device."
        }
        actionTitle={savedCard ? "Remove from this device" : undefined}
        onAction={savedCard ? removeSavedCard : undefined}
        onClose={() => setCardInfoVisible(false)}
      />
    </SettingsPage>
  );
}
