import { fireEvent, render, screen } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import type { StoryTrayItem, SuggestedLive } from "@/types";

import { StoryTray } from "../storyTray";

jest.mock("@/components/icons", () => ({ Frame30132Icon: () => null }));
jest.mock("@/components/live/liveAvatarRing", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { LiveAvatarRing: ({ children }: PropsWithChildren) => <View>{children}</View> };
});
jest.mock("@/components/ui/avatar", () => ({ Avatar: () => null }));
jest.mock("@/components/ui/text", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { Text: ({ children }: PropsWithChildren) => <Text>{children}</Text> };
});
jest.mock("@/theme", () => ({
  makeThemedStyles: (createStyles: (colors: Record<string, string>) => unknown) => () => createStyles({ primary: "#000", primaryTint: "#fff", textFaint: "#888", placeholder: "#eee" }),
  useTheme: () => ({ colors: { primary: "#000", primaryTint: "#fff", textFaint: "#888", placeholder: "#eee" } }),
}));

describe("StoryTray live entries", () => {
  it("opens the suggested live and does not duplicate a host already in the story tray", async () => {
    const live: SuggestedLive = {
      id: "live-1",
      host: { id: "host-1", name: "Ari", username: "ari", avatarUrl: null, verified: false },
      title: "Live title",
      coverUrl: null,
    };
    const stories: StoryTrayItem[] = [
      { user: live.host, hasUnseen: true },
      { user: { id: "story-2", name: "Bola", username: "bola", avatarUrl: null, verified: false }, hasUnseen: true },
    ];
    const onPressLive = jest.fn();

    await render(<StoryTray items={stories} liveItems={[live]} myAvatarUrl={null} onPressAddStory={jest.fn()} onPressStory={jest.fn()} onPressLive={onPressLive} />);

    const liveButton = screen.getByRole("button", { name: "Ari is live, open livestream" });
    fireEvent.press(liveButton);

    expect(onPressLive).toHaveBeenCalledWith("live-1");
    expect(screen.getAllByRole("button", { name: "Ari is live, open livestream" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "View Bola's story" })).toBeTruthy();
  });
});
