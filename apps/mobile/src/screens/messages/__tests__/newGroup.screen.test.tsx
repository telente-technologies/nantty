import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockCreateGroup = jest.fn();
const mockCreateInvitation = jest.fn();
const person = { id: "member-1", name: "Ada Member", username: "ada", avatarUrl: null, verified: false };

jest.mock("@/services/social/groups.service", () => ({
  groupsService: {
    createGroupConversation: (...args: unknown[]) => mockCreateGroup(...args),
    createGroupInvitation: (...args: unknown[]) => mockCreateInvitation(...args),
  },
}));
jest.mock("@/services/social/channels.service", () => ({ channelsService: { createBroadcastChannel: jest.fn() } }));
jest.mock("@/services/media/mediaUploadQueue.service", () => ({ enqueueLocalMediaForUpload: jest.fn(), waitForUploadedMediaId: jest.fn() }));
jest.mock("@/components/chat/groupMemberPicker", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Pressable, Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { GroupMemberPicker: ({ onToggleSelectedPerson }: { onToggleSelectedPerson: (value: typeof person) => void }) =>
    React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: "Select Ada Member", onPress: () => onToggleSelectedPerson(person) }, React.createElement(Text, null, "Select Ada Member")) };
});
jest.mock("@/components/create/pickMedia.util", () => ({ pickPhotosAndVideosFromLibrary: jest.fn() }));
jest.mock("@/components/icons", () => ({ Cancel20Icon: () => null, CameraBolt24Icon: () => null }));
jest.mock("@/components/media/uploadProgressBar", () => ({ UploadProgressBar: () => null }));
jest.mock("@/components/ui/button", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Pressable, Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { Button: ({ title, disabled, loading, onPress }: { title: string; disabled?: boolean; loading?: boolean; onPress: () => void }) =>
    React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: title, accessibilityState: { disabled, busy: loading }, disabled: disabled || loading, onPress }, React.createElement(Text, null, title)) };
});
jest.mock("@/components/ui/keyboardAwareForm", () => ({ KeyboardAwareForm: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/components/ui/keyboardStickyFooter", () => ({ KeyboardStickyFooter: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/components/ui/screen", () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/components/ui/text", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Text: NativeText } = jest.requireActual("react-native") as typeof import("react-native");
  return { Text: ({ children, ...props }: React.ComponentProps<typeof NativeText>) => React.createElement(NativeText, props, children) };
});
jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { surface: "surface", textSubtle: "subtle", divider: "divider", skeleton: "skeleton", primary: "primary", error: "error", textMuted: "muted" } }),
  makeThemedStyles: (factory: (colors: Record<string, string>) => unknown) => () => factory({ surface: "surface", textSubtle: "subtle", divider: "divider", skeleton: "skeleton" }),
}));
jest.mock("expo-image", () => ({ Image: () => null }));

import { ApiError } from "@/errors/api.error";
import { NewGroupScreen } from "../newGroup.screen";

describe("NewGroupScreen group invitation preference recovery", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
    mockCreateGroup.mockReset();
    mockCreateInvitation.mockReset();
  });

  afterEach(async () => {
    cleanup();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it("recovers a server privacy conflict by creating an owner-only group and sending explicit invitations", async () => {
    mockCreateGroup
      .mockRejectedValueOnce(new ApiError(409, "Invite required", "GROUP_INVITATION_REQUIRED"))
      .mockResolvedValueOnce({ id: "group-1", title: "Reading group" });
    mockCreateInvitation.mockResolvedValueOnce({ id: "invite-1", status: "pending" });
    const navigation = { goBack: jest.fn(), replace: jest.fn() } as never;
    await render(
      <QueryClientProvider client={queryClient}>
        <NewGroupScreen navigation={navigation} route={{ key: "new-group", name: "NewGroup", params: { kind: "group" } } as never} />
      </QueryClientProvider>,
    );

    await fireEvent.changeText(screen.getByLabelText("Group name"), "Reading group");
    await fireEvent.press(screen.getByLabelText("Select Ada Member"));
    await fireEvent.press(screen.getByLabelText("Create group (2)"));
    await waitFor(() => expect(screen.getByText(/only accepts group invitations/i)).toBeTruthy());

    await fireEvent.press(screen.getByLabelText("Create group and send invitations"));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("Chat", { conversationId: "group-1", name: "Reading group" }));
    expect(mockCreateGroup).toHaveBeenNthCalledWith(1, { name: "Reading group", memberIds: ["member-1"], photo: null });
    expect(mockCreateGroup).toHaveBeenNthCalledWith(2, { name: "Reading group", memberIds: [], photo: null });
    expect(mockCreateInvitation).toHaveBeenCalledWith("group-1", "member-1");
  });

  it("keeps failed invitation recipients available for an explicit retry after the group is created", async () => {
    mockCreateGroup
      .mockRejectedValueOnce(new ApiError(409, "Invite required", "GROUP_INVITATION_REQUIRED"))
      .mockResolvedValueOnce({ id: "group-2", title: "Reading group" });
    mockCreateInvitation.mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce({ id: "invite-2", status: "pending" });
    const navigation = { goBack: jest.fn(), replace: jest.fn() } as never;
    await render(
      <QueryClientProvider client={queryClient}>
        <NewGroupScreen navigation={navigation} route={{ key: "new-group", name: "NewGroup", params: { kind: "group" } } as never} />
      </QueryClientProvider>,
    );

    await fireEvent.changeText(screen.getByLabelText("Group name"), "Reading group");
    await fireEvent.press(screen.getByLabelText("Select Ada Member"));
    await fireEvent.press(screen.getByLabelText("Create group (2)"));
    await fireEvent.press(await screen.findByLabelText("Create group and send invitations"));
    await waitFor(() => expect(screen.getByText(/Group created; 0 invitations were sent, but 1 could not be sent/i)).toBeTruthy());
    expect(navigation.replace).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText("Retry failed invitations"));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("Chat", { conversationId: "group-2", name: "Reading group" }));
    expect(mockCreateInvitation).toHaveBeenCalledTimes(2);
  });
});
