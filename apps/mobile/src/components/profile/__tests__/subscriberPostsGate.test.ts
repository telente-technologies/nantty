import { fireEvent, render, screen } from "@testing-library/react-native";
import { createElement } from "react";

import { SubscriberPostsGate } from "@/components/profile/subscriberPostsGate";

describe("subscriber posts access gate", () => {
  it("explains the exclusive posts and provides a subscribe action to non-subscribers", async () => {
    const onSubscribe = jest.fn();
    await render(createElement(SubscriberPostsGate, { username: "creator", subscriptionAvailable: true, onSubscribe }));

    expect(screen.getByText("Unlock more with subscriptions")).toBeTruthy();
    expect(screen.getByText(/@creator shares subscriber-only posts and videos/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Subscribe" }));
    expect(onSubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not offer a dead-end subscribe button when the creator has no active plan", async () => {
    await render(createElement(SubscriberPostsGate, { username: "creator", subscriptionAvailable: false }));
    expect(screen.getByText("Subscriptions aren’t available right now.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
  });
});
