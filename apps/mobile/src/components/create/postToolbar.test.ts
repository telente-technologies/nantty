import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { PostToolbar, nextPostAudience } from "@/components/create/postToolbar";
import { ForcedColorSchemeScope } from "@/theme";

const renderToolbar = async (audience: "everyone" | "followers", onToggleAudience = jest.fn()) => {
  const screen = await render(
    createElement(
      ForcedColorSchemeScope,
      { scheme: "light" },
      createElement(PostToolbar, {
        audience,
        onToggleAudience,
        onTakePhoto: jest.fn(),
        onPickFromLibrary: jest.fn(),
      }),
    ),
  );
  return { onToggleAudience, screen };
};

describe("post audience toolbar", () => {
  it("shows Everyone and calls the audience selector", async () => {
    const { onToggleAudience, screen } = await renderToolbar("everyone");
    expect(screen.getByText("Everyone")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Who can see this post" }));
    expect(onToggleAudience).toHaveBeenCalledTimes(1);
  });

  it("shows Followers and cycles only between supported choices", async () => {
    const { screen } = await renderToolbar("followers");
    expect(screen.getByText("Followers")).toBeTruthy();
    expect(nextPostAudience("everyone")).toBe("followers");
    expect(nextPostAudience("followers")).toBe("everyone");
  });
});
