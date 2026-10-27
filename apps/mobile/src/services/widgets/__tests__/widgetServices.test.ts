import { isWidgetTokenDueForRotation } from "../widgetToken.service";
import { maskWidgetAmounts, widgetEndpointFor } from "../widgetSnapshots.service";
import { hiddenAmountText, widgetAmountText, widgetCompactCount, widgetSizeFromDimensions } from "@/widgets/widgetPresentation.util";
import { parseWidgetSession, parseWidgetSnapshot } from "@/widgets/widgetSnapshotReader.util";

jest.mock("@/services/apiClient.service", () => ({ api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() } }));

describe("widget token rotation", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");

  it("rotates when missing, unparseable or within six hours of expiry", () => {
    expect(isWidgetTokenDueForRotation(null, now)).toBe(true);
    expect(isWidgetTokenDueForRotation("not-a-date", now)).toBe(true);
    expect(isWidgetTokenDueForRotation("2026-10-10T17:00:00Z", now)).toBe(true);
    expect(isWidgetTokenDueForRotation("2026-10-11T10:00:00Z", now)).toBe(false);
  });
});

describe("hide amounts on widgets", () => {
  it("asks the server to leave money out for money widgets only", () => {
    expect(widgetEndpointFor("sellerToday", true)).toBe("/api/v1/widgets/seller-today?amounts=hidden");
    expect(widgetEndpointFor("creatorToday", true)).toBe("/api/v1/widgets/creator-today?amounts=hidden");
    expect(widgetEndpointFor("orders", true)).toBe("/api/v1/widgets/orders");
    expect(widgetEndpointFor("sellerToday", false)).toBe("/api/v1/widgets/seller-today");
  });

  it("strips amounts locally even if a response still carries them", () => {
    const seller = maskWidgetAmounts("sellerToday", {
      storeName: "Temi Homes", salesToday: { amountMinor: 100, currency: "NGN" }, ordersToday: 1, ordersToShip: 1,
      availableBalance: { amountMinor: 900, currency: "NGN" }, amountsHidden: false, deepLink: "nantty://seller/dashboard", generatedAt: "",
    }, true);
    expect(seller.salesToday).toBeNull();
    expect(seller.availableBalance).toBeNull();
    expect(seller.amountsHidden).toBe(true);
    expect(widgetAmountText({ amountMinor: 100, currency: "NGN" }, true)).toBe(hiddenAmountText);
    expect(widgetAmountText(null, false)).toBe(hiddenAmountText);
  });
});

describe("widget presentation", () => {
  it("picks small, medium and large layouts from the widget size", () => {
    expect(widgetSizeFromDimensions(150, 150)).toBe("small");
    expect(widgetSizeFromDimensions(320, 150)).toBe("medium");
    expect(widgetSizeFromDimensions(320, 340)).toBe("large");
  });

  it("shortens big counts", () => {
    expect(widgetCompactCount(999)).toBe("999");
    expect(widgetCompactCount(12_480)).toBe("12.5K");
    expect(widgetCompactCount(2_000_000)).toBe("2M");
  });

  it("treats corrupt shared data as missing instead of crashing", () => {
    expect(parseWidgetSnapshot("{oops")).toBeNull();
    expect(parseWidgetSnapshot(JSON.stringify({ state: "hacked" }))).toBeNull();
    expect(parseWidgetSnapshot(JSON.stringify({ state: "signedOut" }))).toEqual({ state: "signedOut" });
    expect(parseWidgetSession(JSON.stringify({ signedIn: "yes" }))).toBeNull();
  });
});
