import { expect, type Page, type TestInfo } from "@playwright/test";

import { collectUnreadableMessages } from "../pageGuard.js";

export async function readBackgroundLuminance(page: Page): Promise<number> {
  return page.evaluate(() => {
    const pick = (element: Element | null): string => {
      let current: Element | null = element;
      while (current !== null) {
        const color = getComputedStyle(current).backgroundColor;
        if (color !== "" && !/rgba\(.*,\s*0\)$/.test(color) && color !== "transparent") return color;
        current = current.parentElement;
      }
      return "rgb(255, 255, 255)";
    };
    const probe = document.querySelector("main") ?? document.body;
    const [r = 255, g = 255, b = 255] = (pick(probe).match(/[\d.]+/g) ?? []).map(Number);
    const channel = (value: number) => {
      const scaled = value / 255;
      return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  });
}

export async function expectDarkRendering(page: Page, testInfo: TestInfo, label: string): Promise<void> {
  await page.waitForTimeout(300);
  const luminance = await readBackgroundLuminance(page);
  const themeAttribute = await page.evaluate(() => document.documentElement.getAttribute("data-theme") ?? document.documentElement.className);
  await testInfo.attach(`dark-${label}.png`, { body: await page.screenshot({ fullPage: false }), contentType: "image/png" });
  expect(luminance, `dark mode background is dark on ${label} (theme marker: ${themeAttribute})`).toBeLessThan(0.2);
  const textColorIsLight = await page.evaluate(() => {
    const color = getComputedStyle(document.body).color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
    return (color[0]! + color[1]! + color[2]!) / 3 > 127;
  });
  expect(textColorIsLight, `body text is light on dark background on ${label}`).toBe(true);
}

export async function expectReadableMessages(page: Page): Promise<void> {
  expect(await collectUnreadableMessages(page), "user-facing messages are human-readable").toEqual([]);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page has no horizontal scroll").toBeLessThanOrEqual(1);
}
