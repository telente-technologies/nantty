import { createElement } from "react";
import { render, screen } from "@testing-library/react-native";

import { BrandLoader } from "@/components/ui/brandLoader";

const mockReducedMotion = { value: false };
const mockRepeat = jest.fn((value: number) => value);

jest.mock("@/hooks/useReducedMotionPreference.hook", () => ({ useReducedMotionPreference: () => mockReducedMotion.value }));
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
    withRepeat: (value: number) => mockRepeat(value),
  };
});

beforeEach(() => mockRepeat.mockClear());

test("renders the logo mark as a busy progressbar with a loading label", async () => {
  await render(createElement(BrandLoader, { size: "lg", showLabel: true }));
  const loader = screen.getByTestId("brand-loader");
  expect(loader.props.accessibilityRole).toBe("progressbar");
  expect(loader.props.accessibilityLabel).toBe("Loading…");
  expect(loader.props.accessibilityState).toMatchObject({ busy: true });
  expect(screen.getByText("Loading…")).toBeTruthy();
  expect(JSON.stringify(screen.toJSON())).toContain('"width":64');
  expect(mockRepeat).toHaveBeenCalled();
});

test("reduced motion shows a static mark", async () => {
  mockReducedMotion.value = true;
  await render(createElement(BrandLoader, { size: "sm", accessibilityLabel: "Loading reviews" }));
  expect(screen.getByLabelText("Loading reviews")).toBeTruthy();
  expect(mockRepeat).not.toHaveBeenCalled();
  expect(JSON.stringify(screen.toJSON())).not.toContain('"opacity"');
  mockReducedMotion.value = false;
});
