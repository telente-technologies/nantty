import { useState } from "react";

import { InfoSheet } from "@/components/settings/infoSheet";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import type { MainScreenProps } from "@/navigation/navigation.types";

export function SettingsPaymentMethodsScreen({ navigation }: MainScreenProps<"SettingsPaymentMethods">) {
  const [cardInfoVisible, setCardInfoVisible] = useState(false);
  return (
    <SettingsPage title="Payment Methods">
      <SettingsGroup>
        <SettingsRow label="Card" onPress={() => setCardInfoVisible(true)} />
        <SettingsRow label="Wallets" onPress={() => navigation.navigate("Wallet")} />
        <SettingsRow label="Subscriptions" onPress={() => navigation.navigate("MySubscriptions")} />
        <SettingsRow label="Payout for Sellers" onPress={() => navigation.navigate("PayoutAccounts")} />
      </SettingsGroup>
      <InfoSheet
        visible={cardInfoVisible}
        title="Cards"
        message="You pay by card securely through Paystack or Flutterwave at checkout. Zudomart never stores your card number."
        onClose={() => setCardInfoVisible(false)}
      />
    </SettingsPage>
  );
}
