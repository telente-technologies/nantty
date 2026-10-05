import { createElement } from "react";
import { render, screen } from "@testing-library/react-native";

import { BootSplash } from "@/components/brand/bootSplash";

test("boot splash exposes one Zudomart image with the logo and wordmark", async () => {
  await render(createElement(BootSplash));
  const [splash] = screen.getAllByLabelText("Zudomart");
  expect(splash.props.accessible).toBe(true);
  expect(splash.props.accessibilityRole).toBe("image");
  expect(JSON.stringify(screen.toJSON())).toContain('"width":160');
});
