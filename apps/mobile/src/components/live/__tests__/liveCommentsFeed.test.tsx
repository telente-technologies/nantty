import { fireEvent, render, screen } from "@testing-library/react-native";
import type React from "react";

import type { LiveComment } from "@/types";

import { LiveCommentsFeed } from "../liveCommentsFeed";

jest.mock("@/components/mentions/mentionText", () => ({ MentionText: ({ text }: { text: string }) => {
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>("react-native");
  return <NativeText>{text}</NativeText>;
} }));
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: { View }, FadeInDown: { duration: () => undefined } };
});
jest.mock("@/components/profile/verificationBadge", () => ({ VerificationBadge: () => null }));
jest.mock("@/components/ui/avatar", () => ({ Avatar: () => null }));
jest.mock("@/components/ui/text", () => ({ Text: ({ children, ...props }: { children?: React.ReactNode }) => {
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>("react-native");
  return <NativeText {...props}>{children}</NativeText>;
} }));
jest.mock("@/hooks/useReducedMotionPreference.hook", () => ({ useReducedMotionPreference: () => true }));
jest.mock("@/theme", () => ({ useTheme: () => ({ colors: { link: "#123456" } }) }));
jest.mock("../liveSurface.constant", () => ({ useLiveForeground: () => ({ chip: "#fff", ink: "#111", inkMuted: "#555" }) }));

describe("LiveCommentsFeed", () => {
  it("renders history recovery and invokes retry without changing comment rows", async () => {
    const retry = jest.fn();
    await render(
      <LiveCommentsFeed
        comments={[comment("latest", "Latest message")]}
        isShownOverVideo={false}
        olderError
        onRetryOlder={retry}
      />,
    );

    expect(screen.getByText("Latest message")).toBeTruthy();
    fireEvent.press(screen.getByText("Couldn’t load earlier comments. Tap to retry."));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows a loading indicator and no-history state distinctly", async () => {
    const { rerender } = await render(
      <LiveCommentsFeed comments={[]} isShownOverVideo={false} canLoadOlder isLoadingOlder />,
    );
    expect(screen.queryByText("Scroll for earlier comments")).toBeNull();
    await rerender(<LiveCommentsFeed comments={[]} isShownOverVideo={false} canLoadOlder />);
    expect(screen.getByText("Scroll for earlier comments")).toBeTruthy();
  });

  it("exposes an accessible manual trigger for the older edge", async () => {
    const loadOlder = jest.fn();
    await render(<LiveCommentsFeed comments={[]} isShownOverVideo={false} canLoadOlder onLoadOlder={loadOlder} />);
    fireEvent.press(screen.getByText("Scroll for earlier comments"));
    expect(loadOlder).toHaveBeenCalledTimes(1);
  });
});

function comment(id: string, text: string): LiveComment {
  return {
    id,
    author: { id: "viewer-1", name: "Viewer", username: "viewer", avatarUrl: null, verified: false },
    text,
    kind: "comment",
  };
}
