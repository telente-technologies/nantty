import { createElement, type FC } from "react";
import { render, screen } from "@testing-library/react-native";
import * as icons from "@/components/icons";

test("every icon renders", async () => {
  let count = 0;
  for (const Icon of Object.values(icons)) {
    if (typeof Icon !== "function") continue;
    const result = await render(createElement(Icon as FC<{ size?: number }>, { size: 20 }));
    expect(screen.toJSON()).toBeTruthy();
    await result.unmount();
    count += 1;
  }
  expect(count).toBe(137);
});

test("padded tab icon keeps footprint", async () => {
  await render(createElement(icons.Home33Icon));
  expect(JSON.stringify(screen.toJSON())).toContain('"width":33');
});
