import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { PanResponder, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { FeedTab } from "@/components/home/feedTab";
import { HomeHeader, type HomeSection } from "@/components/home/homeHeader";
import {
  dragOffsetWithEdgeResistance,
  homeSections,
  isHorizontalSectionSwipe,
  resolveSectionIndexAfterRelease,
  sectionIndexOf,
} from "@/components/home/homeSectionSwipe.util";
import { HomeSectionVisibilityContext } from "@/components/home/homeSectionVisibility.context";
import { isTouchInsideHorizontalScroller, resetHorizontalScrollerTouches } from "@/components/home/horizontalScrollGestureGuard.util";
import { MartTab } from "@/components/home/martTab";
import { Screen } from "@/components/ui/screen";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { useTheme } from "@/theme";
import { requireAuthThen } from "@/utils/requireAuth.util";

const SECTION_SPRING = { damping: 26, stiffness: 260, mass: 1, overshootClamping: true } as const;

export function HomeScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { width: pageWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotionPreference();
  const [activeSection, setActiveSection] = useState<HomeSection>("feed");
  const [hasOpenedMart, setHasOpenedMart] = useState(false);
  const pagerOffset = useSharedValue(0);
  const latest = useRef({ activeSection, pageWidth, reduceMotion });
  latest.current = { activeSection, pageWidth, reduceMotion };

  const settlePagerOnSection = useCallback(
    (section: HomeSection, releaseVelocityPixelsPerMillisecond = 0) => {
      const { pageWidth: width, reduceMotion: shouldReduceMotion } = latest.current;
      const targetOffset = -sectionIndexOf(section) * width;
      pagerOffset.value = shouldReduceMotion
        ? withTiming(targetOffset, { duration: 120, easing: Easing.out(Easing.quad) })
        : withSpring(targetOffset, { ...SECTION_SPRING, velocity: releaseVelocityPixelsPerMillisecond * 1000 });
    },
    [pagerOffset],
  );

  const changeSection = useCallback(
    (section: HomeSection, releaseVelocityPixelsPerMillisecond = 0) => {
      if (section === "mart") setHasOpenedMart(true);
      setActiveSection(section);
      settlePagerOnSection(section, releaseVelocityPixelsPerMillisecond);
    },
    [settlePagerOnSection],
  );

  useEffect(() => {
    pagerOffset.value = -sectionIndexOf(latest.current.activeSection) * pageWidth;
  }, [pageWidth, pagerOffset]);

  const [sectionSwipe] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => !isTouchInsideHorizontalScroller() && isHorizontalSectionSwipe(gesture.dx, gesture.dy),
      onPanResponderGrant: () => {
        cancelAnimation(pagerOffset);
        setHasOpenedMart(true);
      },
      onPanResponderMove: (_, gesture) => {
        const { activeSection: section, pageWidth: width } = latest.current;
        pagerOffset.value = dragOffsetWithEdgeResistance(sectionIndexOf(section), gesture.dx, width);
      },
      onPanResponderRelease: (_, gesture) => {
        const { activeSection: section, pageWidth: width } = latest.current;
        const nextIndex = resolveSectionIndexAfterRelease(sectionIndexOf(section), gesture.dx, gesture.vx, width);
        changeSection(homeSections[nextIndex] ?? section, gesture.vx);
      },
      onPanResponderTerminate: () => settlePagerOnSection(latest.current.activeSection),
    }),
  );

  const pagerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pagerOffset.value }] }));

  return (
    <Screen background={colors.surface}>
      <HomeHeader
        activeSection={activeSection}
        onChangeSection={(section) => changeSection(section)}
        pagerOffset={pagerOffset}
        pageWidth={pageWidth}
        onPressSearch={() => navigation.navigate("Search", { scope: activeSection === "mart" ? "mart" : "global" })}
        onPressNotifications={() => requireAuthThen(() => navigation.navigate("Notifications"), undefined, "see your notifications")}
      />
      <View
        style={styles.viewport}
        {...sectionSwipe.panHandlers}
        onTouchEnd={(event) => {
          if (event.nativeEvent.touches.length === 0) resetHorizontalScrollerTouches();
        }}
      >
        <Animated.View style={[styles.pager, { width: pageWidth * homeSections.length }, pagerStyle]}>
          <View style={{ width: pageWidth }} accessibilityElementsHidden={activeSection !== "feed"} importantForAccessibility={activeSection === "feed" ? "auto" : "no-hide-descendants"}>
            <HomeSectionVisibilityContext.Provider value={activeSection === "feed"}>
              <FeedTab />
            </HomeSectionVisibilityContext.Provider>
          </View>
          <View style={{ width: pageWidth }} accessibilityElementsHidden={activeSection !== "mart"} importantForAccessibility={activeSection === "mart" ? "auto" : "no-hide-descendants"}>
            <HomeSectionVisibilityContext.Provider value={activeSection === "mart"}>{hasOpenedMart ? <MartTab /> : null}</HomeSectionVisibilityContext.Provider>
          </View>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden" },
  pager: { flex: 1, flexDirection: "row" },
});
