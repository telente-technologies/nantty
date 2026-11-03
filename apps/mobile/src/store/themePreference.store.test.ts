jest.mock("@/utils/devicePreferenceStorage.util", () => ({
  readDevicePreference: jest.fn(() => ({ available: true, value: "light" })),
  writeDevicePreference: jest.fn(),
}));

jest.mock("@/utils/secureStorage.util", () => ({
  retryWhenAppComesToForeground: jest.fn(),
}));

import { useThemePreferenceStore } from "./themePreference.store";

describe("theme preference account hydration", () => {
  beforeEach(() => {
    useThemePreferenceStore.setState({ preference: "light", localChoiceVersion: 0 });
  });

  it("applies an account preference when the user has not changed it during the request", () => {
    useThemePreferenceStore.getState().applyAccountPreference("dark", 0);

    expect(useThemePreferenceStore.getState().preference).toBe("dark");
    expect(useThemePreferenceStore.getState().localChoiceVersion).toBe(0);
  });

  it("does not overwrite a newer local choice when account settings arrive late", () => {
    useThemePreferenceStore.getState().setPreference("system");
    useThemePreferenceStore.getState().applyAccountPreference("dark", 0);

    expect(useThemePreferenceStore.getState().preference).toBe("system");
    expect(useThemePreferenceStore.getState().localChoiceVersion).toBe(1);
  });
});
