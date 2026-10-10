import { useNavigation } from "@react-navigation/native";
import { useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";

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
  const sectionRef = useRef(activeSection);
  sectionRef.current = activeSection;

  const [sectionSwipe] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 24 && Math.abs(gesture.dy) < 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -60 && sectionRef.current === "feed") setActiveSection("mart");
        else if (gesture.dx > 60 && sectionRef.current === "mart") setActiveSection("feed");
      },
    }),
  );

  return (
    <Screen background={colors.surface}>
      <HomeHeader
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        onPressSearch={() => navigation.navigate("Search", { scope: activeSection === "mart" ? "mart" : "global" })}
        onPressNotifications={() => requireAuthThen(() => navigation.navigate("Notifications"), undefined, "see your notifications")}
      />
      <View style={styles.content} {...sectionSwipe.panHandlers}>
        {activeSection === "feed" ? <FeedTab /> : <MartTab />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
