import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { ProfileTabs } from "@/components/profile/profileTabs";

jest.setTimeout(30_000);

test("active tab shows its label while inactive tabs show icons only", async () => {
  const onChangeTab = jest.fn();
  await render(createElement(ProfileTabs, { tabs: ["posts", "reposts", "clips"], activeTab: "reposts", onChangeTab }));
  expect(screen.getByText("Reposts")).toBeTruthy();
  expect(screen.queryByText("Posts")).toBeNull();
  expect(screen.queryByText("Clips")).toBeNull();
  expect(screen.getByLabelText("Posts")).toBeTruthy();
  expect(screen.getByLabelText("Clips")).toBeTruthy();
});

test("switching to clips shows the clips label and hides the rest", async () => {
  const onChangeTab = jest.fn();
  await render(createElement(ProfileTabs, { tabs: ["posts", "reposts", "clips"], activeTab: "clips", onChangeTab }));
  expect(screen.getByText("Clips")).toBeTruthy();
  expect(screen.queryByText("Reposts")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Posts"));
  expect(onChangeTab).toHaveBeenCalledWith("posts");
});

test("subscriber tab is optional and fits the same flexible tab row", async () => {
  const onChangeTab = jest.fn();
  const screenView = await render(createElement(ProfileTabs, { tabs: ["posts", "reposts", "clips"], activeTab: "posts", onChangeTab }));
  expect(screen.queryByLabelText("Subscriber posts")).toBeNull();
  await act(async () => {
    screenView.rerender(createElement(ProfileTabs, { tabs: ["posts", "reposts", "clips", "subscribers"], activeTab: "subscribers", onChangeTab }));
  });
  expect(screen.getByLabelText("Subscriber posts")).toBeTruthy();
  expect(screen.getByText("Subs")).toBeTruthy();
});
