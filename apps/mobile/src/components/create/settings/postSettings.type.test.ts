import { DEFAULT_POST_SETTINGS, buildPostSettingsFields } from "./postSettings.type";

describe("post settings create payload", () => {
  it("does not expose or send subscriber-only visibility before the active-plan gate exists", () => {
    const fields = buildPostSettingsFields(DEFAULT_POST_SETTINGS);
    expect(fields).not.toHaveProperty("visibility");
    expect(fields).toMatchObject({ replyPolicy: "everyone" });
  });
});
