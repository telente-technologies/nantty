import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import type { CartItem, ReturnRequestView } from "@/types";

jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { surface: "surface", text: "text", textMuted: "muted", textSubtle: "subtle", primaryTint: "tint", divider: "divider", background: "background", disabledText: "disabled", error: "error" } }),
  makeThemedStyles: (factory: (colors: Record<string, string>) => unknown) => () => factory({ surface: "surface", text: "text", textMuted: "muted", textSubtle: "subtle", primaryTint: "tint", divider: "divider", background: "background", disabledText: "disabled", error: "error" }),
}));
jest.mock("@/components/ui/text", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>("react-native");
  return { Text: ({ children, ...props }: React.ComponentProps<typeof NativeText>) => React.createElement(NativeText, props, children) };
});
jest.mock("@/components/ui/button", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { Button: ({ title, disabled, loading, onPress }: { title: string; disabled?: boolean; loading?: boolean; onPress: () => void }) => React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: title, accessibilityState: { disabled, busy: loading }, disabled: disabled || loading, onPress }, React.createElement(Text, null, title)) };
});

import { ReturnRequestForm } from "./returnRequestForm";

const items: CartItem[] = [{
  id: "order-item-1",
  quantity: 2,
  variant: "Medium",
  product: { id: "product-1", name: "Cotton shirt", imageUrl: null, price: { amountMinor: 2500, currency: "NGN" } },
}];

const returnRequest: ReturnRequestView = {
  id: "return-1", orderId: "order-1", orderNumber: "NAN-1", buyerName: "Ada",
  lines: [], reason: "Wrong size", status: "requested", declineNote: null,
  refundAmount: { amountMinor: 2500, currency: "NGN" }, createdAt: "2026-11-07T12:00:00.000Z",
};

afterEach(cleanup);

it("bounds item quantity to the purchased amount and submits selected lines with a trimmed reason", async () => {
  const onSubmit = jest.fn();
  await render(<ReturnRequestForm items={items} submitting={false} onSubmit={onSubmit} />);

  await fireEvent.press(screen.getByLabelText("Add one Cotton shirt to return"));
  await fireEvent.press(screen.getByLabelText("Add one Cotton shirt to return"));
  expect(screen.getByLabelText("Add one Cotton shirt to return").props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(screen.getByLabelText("Reason for return"), "  Arrived damaged  ");
  await fireEvent.press(screen.getByLabelText("Submit return request"));

  expect(onSubmit).toHaveBeenCalledWith({ lines: [{ orderItemId: "order-item-1", quantity: 2 }], reason: "Arrived damaged" });
});

it("shows a known active request without treating a missing list record as eligibility proof", async () => {
  await render(<ReturnRequestForm items={items} knownRequest={returnRequest} submitting={false} onSubmit={jest.fn()} />);

  expect(screen.getByText(/Return request requested/)).toBeTruthy();
  expect(screen.queryByLabelText("Submit return request")).toBeNull();
});
