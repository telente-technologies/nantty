const mockCamera = {
  getCameraPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  getMicrophonePermissionsAsync: jest.fn(),
  requestMicrophonePermissionsAsync: jest.fn(),
};
const mockShowAlert = jest.fn();
const mockOpenSettings = jest.fn(() => Promise.resolve());

jest.mock("expo-camera", () => ({ get Camera() { return mockCamera; } }));
jest.mock("react-native", () => ({ Linking: { openSettings: () => mockOpenSettings() } }));
jest.mock("@/utils/crossPlatformAlert.util", () => ({ showAlertWithButtons: (...args: unknown[]) => mockShowAlert(...args) }));

import { ensureLiveCameraAndMicrophone, promptToEnableLiveMediaInSettings } from "../liveMediaPermissions.service";

const permission = (granted: boolean, canAskAgain = true) => ({ granted, canAskAgain });

describe("live camera and microphone permissions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("asks once and goes live when both are allowed", async () => {
    mockCamera.getCameraPermissionsAsync.mockResolvedValue(permission(false));
    mockCamera.requestCameraPermissionsAsync.mockResolvedValue(permission(true));
    mockCamera.getMicrophonePermissionsAsync.mockResolvedValue(permission(true));
    await expect(ensureLiveCameraAndMicrophone(true)).resolves.toBe("granted");
    expect(mockCamera.requestMicrophonePermissionsAsync).not.toHaveBeenCalled();
  });

  it("reports denial without asking again when the OS won't show the prompt", async () => {
    mockCamera.getCameraPermissionsAsync.mockResolvedValue(permission(false, false));
    mockCamera.getMicrophonePermissionsAsync.mockResolvedValue(permission(true));
    await expect(ensureLiveCameraAndMicrophone(true)).resolves.toBe("denied");
    expect(mockCamera.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it("treats a permission API failure as denied instead of throwing", async () => {
    mockCamera.getMicrophonePermissionsAsync.mockRejectedValue(new Error("native"));
    await expect(ensureLiveCameraAndMicrophone(false)).resolves.toBe("denied");
  });

  it("offers Settings in a friendly prompt", () => {
    promptToEnableLiveMediaInSettings(true);
    const [title, , buttons] = mockShowAlert.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    expect(title).toBe("Turn on your camera and microphone");
    buttons.find((button) => button.text === "Open Settings")!.onPress!();
    expect(mockOpenSettings).toHaveBeenCalled();
  });
});
