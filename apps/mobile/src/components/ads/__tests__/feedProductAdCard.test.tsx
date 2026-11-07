import { fireEvent, render } from "@testing-library/react-native";

import { FeedProductAdCard } from "../feedProductAdCard";
import type { ProductAd } from "@/services/ads/productAds.service";

const mockNavigate = jest.fn();
const mockOpenSponsoredTarget = jest.fn();

jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock("@/services/ads/adClick.service", () => ({ openSponsoredTarget: (...args: unknown[]) => mockOpenSponsoredTarget(...args) }));
jest.mock("@/components/profile/verificationBadge", () => ({ VerificationBadge: () => null }));
jest.mock("@/components/ui/avatar", () => ({ Avatar: () => null }));
jest.mock("@/components/feed/sponsoredContent", () => ({
  SponsoredLabel: () => {
    const React = jest.requireActual<typeof import("react")>("react");
    const Native = jest.requireActual<typeof import("react-native")>("react-native");
    return React.createElement(Native.Text, { accessibilityLabel: "Sponsored" }, "Sponsored");
  },
}));
jest.mock("@/components/ui/button", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const Native = jest.requireActual<typeof import("react-native")>("react-native");
  return { Button: ({ title, onPress, accessibilityLabel }: { title: string; onPress: () => void; accessibilityLabel: string }) => React.createElement(Native.Pressable, { accessibilityRole: "button", accessibilityLabel, onPress }, React.createElement(Native.Text, null, title)) };
});
jest.mock("@/components/ui/text", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const Native = jest.requireActual<typeof import("react-native")>("react-native");
  return { Text: ({ children }: { children: string }) => React.createElement(Native.Text, null, children) };
});
jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { textMuted: "#666" } }),
  makeThemedStyles: (factory: (colors: Record<string, string>) => unknown) => () => factory({ surface: "#fff", divider: "#ddd", skeleton: "#eee" }),
}));
jest.mock("expo-image", () => ({ Image: () => null }));

const ad: ProductAd = {
  adId: "feed-ad-1",
  impressionToken: "signed-token-123",
  expiresAt: "2099-01-01T00:00:00.000Z",
  placement: "feed",
  slotKind: "feedProduct",
  format: "product",
  label: "Sponsored",
  creative: {
    format: "product",
    media: [{ kind: "image", url: "https://cdn.nantty.test/product.jpg" }],
    headline: "Handwoven tote",
    primaryText: "Made by Ada Atelier",
    callToAction: "shop_now",
    destination: { type: "product", targetId: "product-7" },
    identity: { name: "Ada Atelier", handle: "adaatelier", verifiedBusiness: true },
  },
};

afterEach(() => {
  jest.clearAllMocks();
});

test("opens the server product destination through the signed sponsored click path", async () => {
  const rendered = await render(<FeedProductAdCard ad={ad} />);
  expect(rendered.getByText("Handwoven tote")).toBeTruthy();
  fireEvent.press(rendered.getByLabelText("Shop now, Handwoven tote"));
  expect(mockOpenSponsoredTarget).toHaveBeenCalledWith(expect.objectContaining({
    placement: "feed",
    itemId: "feed-ad-1",
    target: { kind: "cta" },
    sponsored: expect.objectContaining({ impressionToken: "signed-token-123", destination: { type: "product", targetId: "product-7" } }),
  }));
});

test("uses search as the sponsored click placement when rendered in Explore results", async () => {
  const rendered = await render(<FeedProductAdCard ad={{ ...ad, placement: "search", slotKind: "searchTile" }} placement="search" />);
  expect(rendered.getByLabelText("Sponsored")).toBeTruthy();
  fireEvent.press(rendered.getByLabelText("Shop now, Handwoven tote"));
  expect(mockOpenSponsoredTarget).toHaveBeenCalledWith(expect.objectContaining({
    placement: "search",
    itemId: "feed-ad-1",
    target: { kind: "cta" },
    sponsored: expect.objectContaining({
      impressionToken: "signed-token-123",
      destination: { type: "product", targetId: "product-7" },
    }),
  }));
});
