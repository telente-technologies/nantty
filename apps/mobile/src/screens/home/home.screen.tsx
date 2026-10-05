import { useNavigation } from "@react-navigation/native";
import { useState } from "react";

import { FeedTab } from "@/components/home/feedTab";
import { HomeHeader, type HomeSection } from "@/components/home/homeHeader";
import { MartTab } from "@/components/home/martTab";
import { Screen } from "@/components/ui/screen";
import { useTheme } from "@/theme";
import { requireAuthThen } from "@/utils/requireAuth.util";

export function HomeScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [activeSection, setActiveSection] = useState<HomeSection>("feed");

  return (
    <Screen background={colors.surface}>
      <HomeHeader
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        onPressSearch={() => navigation.navigate("Search", { scope: activeSection === "mart" ? "mart" : "global" })}
        onPressNotifications={() => requireAuthThen(() => navigation.navigate("Notifications"), undefined, "see your notifications")}
      />
      {activeSection === "feed" ? <FeedTab /> : <MartTab />}
    </Screen>
  );
}
