import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import type { CartItem, ReturnRequestView } from "@/types";

jest.mock("@/theme", () => {
  const colors = {
    background: "#fff", surface: "#fff", text: "#111", textMuted: "#666", textSubtle: "#888",
    divider: "#ddd", primary: "#111", primaryTint: "#eee", disabledText: "#999", error: "#b00",
  };
  return { useTheme: () => ({ colors }), makeThemedStyles: (factory: (value: typeof colors) => unknown) => () => factory(colors) };
});
jest.mock("@/components/ui/text", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { Text: ({ children, ...props }: { children: ReactNode }) => React.createElement(Text, props, children) };
});
jest.mock("@/components/ui/button", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Pressable, Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { Button: ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) =>
    React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: title, accessibilityState: { disabled }, disabled, onPress }, React.createElement(Text, null, title)) };
});

import { ReturnRequestForm } from "../returnRequestForm";

const item = (id: string, quantity = 2): CartItem => ({
  id,
  quantity,
  variant: null,
  product: { id: `product-${id}`, name: `Product ${id}`, imageUrl: null, price: { amountMinor: 1000, currency: "NGN" } },
});

describe("ReturnRequestForm", () => {
  afterEach(cleanup);

  it("submits selected order-item IDs, bounded quantities, and trimmed reason", async () => {
    const onSubmit = jest.fn();
    await render(<ReturnRequestForm items={[item("one", 120)]} submitting={false} onSubmit={onSubmit} />);
    for (let count = 0; count < 99; count += 1) await fireEvent.press(screen.getByLabelText("Add one Product one to return"));
    expect(screen.getByLabelText("Add one Product one to return").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Reason for return"), "  Item arrived damaged  ");
    await fireEvent.press(screen.getByLabelText("Submit return request"));

    expect(onSubmit).toHaveBeenCalledWith({ lines: [{ orderItemId: "one", quantity: 99 }], reason: "Item arrived damaged" });
  });

  it("limits a request to 50 distinct lines", async () => {
    const onSubmit = jest.fn();
    const items = Array.from({ length: 51 }, (_, index) => item(String(index)));
    await render(<ReturnRequestForm items={items} submitting={false} onSubmit={onSubmit} />);
    for (let index = 0; index < 50; index += 1) {
      await fireEvent.press(screen.getByLabelText(`Add one Product ${index} to return`));
    }
    expect(screen.getByLabelText("Add one Product 50 to return").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("You can include up to 50 different items in one request.")).toBeTruthy();
  });

  it("shows the server-created status as an unambiguous success receipt", async () => {
    const submitted: ReturnRequestView = {
      id: "return-1", orderId: "order-1", orderNumber: "N-1", buyerName: "Buyer", lines: [],
      reason: "Wrong size", status: "requested", declineNote: null,
      refundAmount: { amountMinor: 0, currency: "NGN" }, createdAt: "2026-11-07T00:00:00Z",
    };
    await render(<ReturnRequestForm items={[item("one")]} submittedRequest={submitted} submitting={false} onSubmit={jest.fn()} />);

    expect(screen.getByText("Return request submitted")).toBeTruthy();
    expect(screen.getByText("Status: requested. The seller will review your request.")).toBeTruthy();
    expect(screen.queryByLabelText("Reason for return")).toBeNull();
  });
});
