import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";

const mockListInvitations = jest.fn();
const mockAcceptInvitation = jest.fn();
const mockDeclineInvitation = jest.fn();
const mockRevokeInvitation = jest.fn();

jest.mock("@/services/social/groups.service", () => ({
  groupsService: {
    listGroupInvitations: (...args: unknown[]) => mockListInvitations(...args),
    acceptGroupInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
    declineGroupInvitation: (...args: unknown[]) => mockDeclineInvitation(...args),
    revokeGroupInvitation: (...args: unknown[]) => mockRevokeInvitation(...args),
  },
}));
jest.mock("@/theme", () => ({ useTheme: () => ({ colors: {
  background: "background", surface: "surface", chip: "chip", text: "text", textMuted: "muted", divider: "divider", error: "error",
} }) }));
jest.mock("@/components/ui/header", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { Header: ({ title }: { title: string }) => React.createElement(Text, null, title) };
});
jest.mock("@/components/ui/screen", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { View } = jest.requireActual("react-native") as typeof import("react-native");
  return { Screen: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children) };
});
jest.mock("@/components/ui/avatar", () => ({ Avatar: () => null }));
jest.mock("@/components/ui/listSkeleton", () => ({ ListSkeleton: () => null }));
jest.mock("@/components/ui/errorState", () => ({ ErrorState: ({ message }: { message: string }) => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Text } = jest.requireActual("react-native") as typeof import("react-native");
  return React.createElement(Text, null, message);
} }));
jest.mock("@/components/ui/button", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const { Pressable, Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { Button: ({ title, disabled, loading, onPress }: { title: string; disabled?: boolean; loading?: boolean; onPress: () => void }) =>
    React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: title, accessibilityState: { disabled, busy: loading }, disabled: disabled || loading, onPress }, React.createElement(Text, null, title)) };
});

import { GroupInvitationsScreen } from "../groupInvitations.screen";
import type { GroupInvitation } from "@/services/social/groups.service";

const receivedInvitation: GroupInvitation = {
  id: "invite-1",
  conversationId: "group-1",
  inviterId: "user-1",
  inviteeId: "user-2",
  status: "pending",
  createdAt: "2026-11-05T10:00:00.000Z",
  expiresAt: "2026-11-12T10:00:00.000Z",
  counterpart: { id: "user-1", name: "Ayo Member", username: "ayo", avatarUrl: null, verified: false },
  membershipStatus: "not_joined",
};

describe("GroupInvitationsScreen", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
    mockListInvitations.mockReset().mockResolvedValue({ data: [receivedInvitation], nextCursor: null });
    mockAcceptInvitation.mockReset();
    mockDeclineInvitation.mockReset();
    mockRevokeInvitation.mockReset();
  });

  afterEach(async () => {
    cleanup();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it("records acceptance but clearly keeps the invitee outside membership and history", async () => {
    mockAcceptInvitation.mockResolvedValue({ ...receivedInvitation, status: "accepted", membershipStatus: "awaiting_secure_key_handoff" });
    const navigation = { goBack: jest.fn() } as never;
    const view = await render(<QueryClientProvider client={queryClient}><GroupInvitationsScreen navigation={navigation} route={{ key: "GroupInvitations", name: "GroupInvitations" } as never} /></QueryClientProvider>);

    await waitFor(() => expect(view.getByText("Ayo Member invited you")).toBeTruthy());
    await fireEvent.press(view.getByLabelText("Accept invitation"));

    await waitFor(() => expect(mockAcceptInvitation).toHaveBeenCalledWith("invite-1"));
    await waitFor(() => expect(view.getByText(/Consent recorded\. You have not joined the group/)).toBeTruthy());
    expect(view.queryByText(/joined the group|group messages/i)).toBeTruthy();
  });
});
