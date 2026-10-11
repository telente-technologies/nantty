import { createElement } from "react";
import { render, screen } from "@testing-library/react-native";

import { BootSplash } from "@/components/brand/bootSplash";

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: { View },
    Easing: { inOut: () => undefined, sin: undefined },
    cancelAnimation: () => undefined,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (value: number) => value,
    withRepeat: (value: number) => value,
  };
});

test("boot splash exposes one Zudomart image with the logo and wordmark", async () => {
  await render(createElement(BootSplash));
  const [splash] = screen.getAllByLabelText("Zudomart");
  expect(splash.props.accessible).toBe(true);
  expect(splash.props.accessibilityRole).toBe("image");
  expect(JSON.stringify(screen.toJSON())).toContain('"width":160');
});
