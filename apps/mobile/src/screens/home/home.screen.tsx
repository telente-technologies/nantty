import { useNavigation } from "@react-navigation/native";
import { useState } from "react";

import { FeedTab } from "@/components/home/feedTab";
import { HomeHeader, type HomeSection } from "@/components/home/homeHeader";
import { MartTab } from "@/components/home/martTab";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/constants/colors.constant";

export function HomeScreen() {
  const navigation = useNavigation();
  const [activeSection, setActiveSection] = useState<HomeSection>("feed");

  return (
    <Screen background={colors.white}>
      <HomeHeader
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        onPressSearch={() => navigation.navigate("Search", { scope: activeSection === "mart" ? "mart" : "all" })}
        onPressNotifications={() => navigation.navigate("Notifications")}
      />
      {activeSection === "feed" ? <FeedTab /> : <MartTab />}
    </Screen>
  );
}
