import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { MART_CAROUSEL_AUTO_ADVANCE_MS, MartHighlightsCarousel } from "@/components/home/martHighlightsCarousel";
import { orderMartHighlightsForSession } from "@/components/home/martHighlightsOrder.util";
import { adEventsService } from "@/services/adEvents.service";
import type { MartHighlight } from "@/types/martHighlight.type";

jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("@/services/adEvents.service", () => ({ adEventsService: { recordSponsoredImpressionOncePerSession: jest.fn() } }));

const boosted = (id: string): MartHighlight => ({
  id,
  kind: "boosted_product",
  title: `Product ${id}`,
  subtitle: "Ada Stores",
  imageUrl: null,
  target: { type: "product", productId: `pr_${id}`, name: `Product ${id}` },
  ranking: { score: 0.9, reason: { code: "sponsored", label: "Sponsored" } },
  sponsored: { campaignId: `cmp_${id}`, label: "Sponsored", advertiserName: "Ada Stores" },
});

const editorial = (id: string): MartHighlight => ({
  id,
  kind: "new_arrivals",
  title: "New Arrivals",
  subtitle: null,
  imageUrl: null,
  target: { type: "collection", collection: "new_arrivals", name: "New Arrivals" },
  ranking: { score: 0.5, reason: { code: "fresh_listings", label: "Fresh this week" } },
});

const renderCarousel = async (highlights: readonly MartHighlight[], loading = false) => {
  const onPressHighlight = jest.fn();
  await render(createElement(MartHighlightsCarousel, { highlights, loading, visible: true, onPressHighlight }));
  return onPressHighlight;
};

const layOut = async (width = 320) => {
  await fireEvent(screen.getByTestId("martHighlightsCarousel"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height: 140 } } });
};

const carouselLabel = () => screen.getByTestId("martHighlightsCarousel").props.accessibilityLabel as string;

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test("renders a horizontal, paging, swipeable list once the width is known", async () => {
  await renderCarousel([boosted("a"), boosted("b"), editorial("c")]);
  expect(screen.queryByTestId("martHighlightsList")).toBeNull();
  await layOut();
  const list = screen.getByTestId("martHighlightsList");
  expect(list.props.horizontal).toBe(true);
  expect(list.props.pagingEnabled).toBe(true);
  expect(list.props.scrollEnabled).toBe(true);
  expect(list.props.removeClippedSubviews).toBe(false);
  const root = screen.getByTestId("martHighlightsCarousel");
  expect(root.props.accessibilityRole).toBe("adjustable");
  expect(carouselLabel()).toBe("Highlights, 1 of 3. Product a. Sponsored · Ada Stores");
  await fireEvent(root, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
  expect(carouselLabel()).toContain("2 of 3");
  await fireEvent(root, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
  await fireEvent(root, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
  expect(carouselLabel()).toContain("3 of 3");
});

test("swiping settles on the page under the finger", async () => {
  await renderCarousel([boosted("a"), boosted("b"), editorial("c")]);
  await layOut(300);
  await fireEvent(screen.getByTestId("martHighlightsList"), "momentumScrollEnd", { nativeEvent: { contentOffset: { x: 600, y: 0 } } });
  expect(carouselLabel()).toContain("3 of 3");
});

test("autoplay advances, and pauses while the user is dragging", async () => {
  jest.useFakeTimers();
  await renderCarousel([boosted("a"), boosted("b")]);
  await layOut();
  await act(async () => { jest.advanceTimersByTime(MART_CAROUSEL_AUTO_ADVANCE_MS); });
  expect(carouselLabel()).toContain("2 of 2");
  const list = screen.getByTestId("martHighlightsList");
  await fireEvent(list, "scrollBeginDrag");
  await act(async () => { jest.advanceTimersByTime(MART_CAROUSEL_AUTO_ADVANCE_MS * 3); });
  expect(carouselLabel()).toContain("2 of 2");
  await fireEvent(list, "scrollEndDrag");
  await act(async () => { jest.advanceTimersByTime(MART_CAROUSEL_AUTO_ADVANCE_MS); });
  expect(carouselLabel()).toContain("1 of 2");
});

test("records one sponsored impression for the boosted slide on screen", async () => {
  await renderCarousel([boosted("a"), editorial("c")]);
  expect(adEventsService.recordSponsoredImpressionOncePerSession).toHaveBeenCalledWith(expect.objectContaining({ campaignId: "cmp_a" }), "mart", "pr_a");
});

test("renders nothing when empty, and a placeholder while loading", async () => {
  await renderCarousel([]);
  expect(screen.toJSON()).toBeNull();
  await renderCarousel([], true);
  expect(screen.getByLabelText("Loading highlights")).toBeTruthy();
});

test("a single highlight is static: no paging, dots or autoplay, but still opens", async () => {
  jest.useFakeTimers();
  const onPressHighlight = await renderCarousel([editorial("only")]);
  await layOut();
  expect(screen.getByTestId("martHighlightsList").props.scrollEnabled).toBe(false);
  const root = screen.getByTestId("martHighlightsCarousel");
  expect(root.props.accessibilityActions).toEqual([{ name: "activate" }]);
  await act(async () => { jest.advanceTimersByTime(MART_CAROUSEL_AUTO_ADVANCE_MS * 2); });
  expect(carouselLabel()).toBe("Highlights, 1 of 1. New Arrivals. Fresh this week");
  await fireEvent(root, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
  expect(onPressHighlight).toHaveBeenCalledWith(expect.objectContaining({ id: "only" }));
});

test("session order puts boosted products first, shuffled per session and stable within it", () => {
  const input = [editorial("e1"), ...["a", "b", "c", "d", "e", "f"].map(boosted), editorial("e2"), boosted("a")];
  const first = orderMartHighlightsForSession(input, 1).map((highlight) => highlight.id);
  expect(first).toHaveLength(8);
  expect(first.slice(6)).toEqual(["e1", "e2"]);
  expect(orderMartHighlightsForSession(input, 1).map((highlight) => highlight.id)).toEqual(first);
  const orders = new Set([2, 3, 4, 5, 6].map((seed) => orderMartHighlightsForSession(input, seed).map((highlight) => highlight.id).join(",")));
  expect(orders.size).toBeGreaterThan(1);
  expect(orderMartHighlightsForSession([])).toEqual([]);
});
