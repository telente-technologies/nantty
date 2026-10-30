import { ApiError } from "@/errors/api.error";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { getSignedInMockUser, buildMockUserSummary } from "./fixtures.mock";
import { signedInUserIsApprovedCreator } from "./creatorFixtures.mock";
import { mockPostsState } from "./postCatalog.mock";
import type { Space, SpaceGrant } from "@/services/spaces.service";

const host = { ...buildMockUserSummary(2), role: "host" as const };
const rooms = new Map<string, Space>([
  [
    "space_demo_live",
    {
      id: "space_demo_live",
      title: "The creative check-in",
      description:
        "An open conversation about making things, finding your audience, and starting again.",
      state: "live",
      host,
      listenerCount: 128,
      speakers: [],
    },
  ],
  [
    "space_demo_scheduled",
    {
      id: "space_demo_scheduled",
      title: "Sunday ideas, shared out loud",
      description:
        "Bring one idea you want to work on. We will talk it through together.",
      state: "scheduled",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      host,
      listenerCount: 0,
      speakers: [],
    },
  ],
]);
const joined = new Map<string, Set<string>>();
const requests = new Map<string, { id: string; user: Space["host"] }[]>();
const find = (id: string) => {
  const room = rooms.get(id);
  if (!room) throw new ApiError(404, "Space not found.", "SPACE_NOT_FOUND");
  return room;
};
const isHost = (room: Space) => room.host.id === getSignedInMockUser().id;
const requireHost = (room: Space) => {
  if (!isHost(room) || !signedInUserIsApprovedCreator())
    throw new ApiError(403, "Only the creator host can do that.", "FORBIDDEN");
};
for (const room of rooms.values()) room.announcementPostId = `post_${room.id}`;
const seed = [...mockPostsState.values()].find((post) => post.kind === "post");
if (seed)
  for (const room of rooms.values())
    mockPostsState.set(`post_${room.id}`, {
      ...seed,
      id: `post_${room.id}`,
      author: { ...host, username: host.username || "creator" },
      text: `Join my Space: ${room.title}\nhttps://web.nantty.com/spaces/${room.id}`,
      media: [],
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
      liked: false,
    });
export const spacesMocks: MockRoute[] = [
  createMockRoute(
    "POST",
    "/api/v1/spaces/:spaceId/announcement",
    ({ params, body }) => {
      const room = find(params.spaceId!);
      requireHost(room);
      const { postId } = body as { postId: string };
      if (room.announcementPostId && room.announcementPostId !== postId)
        throw new ApiError(
          409,
          "This Space already has an announcement.",
          "ANNOUNCEMENT_ALREADY_BOUND",
        );
      if (room.announcementPostId === postId) return { postId };
      const post = mockPostsState.get(postId);
      if (
        !post ||
        post.author.id !== getSignedInMockUser().id ||
        !post.text.split(/\s+/).some((word) => {
          try {
            const url = new URL(word);
            return (
              [
                "web.nantty.com",
                "nantty.com",
                "www.nantty.com",
                "localhost",
                "127.0.0.1",
              ].includes(url.hostname) && url.pathname === `/spaces/${room.id}`
            );
          } catch {
            return false;
          }
        })
      )
        throw new ApiError(
          422,
          "Choose your public announcement post for this Space.",
          "INVALID_POST",
        );
      room.announcementPostId = postId;
      return { postId };
    },
  ),
  createMockRoute("GET", "/api/v1/spaces", () =>
    [...rooms.values()].filter((room) =>
      ["live", "scheduled"].includes(room.state),
    ),
  ),
  createMockRoute("POST", "/api/v1/spaces", ({ body }) => {
    if (!signedInUserIsApprovedCreator())
      throw new ApiError(
        403,
        "Join the Creator Program to host.",
        "CREATOR_PROGRAM_NEEDED",
      );
    const input = body as {
      title?: string;
      description?: string;
      scheduledAt?: string;
    };
    if (!input.title?.trim() || input.title.length > 140)
      throw new ApiError(422, "Add a title.", "INVALID_TITLE");
    if (
      input.scheduledAt &&
      !(new Date(input.scheduledAt).getTime() > Date.now())
    )
      throw new ApiError(422, "Choose a future time.", "INVALID_SCHEDULE");
    const room: Space = {
      id: `space_${Date.now()}_${rooms.size}`,
      title: input.title.trim(),
      description: input.description,
      state: input.scheduledAt ? "scheduled" : "live",
      scheduledAt: input.scheduledAt,
      host: { ...getSignedInMockUser(), role: "host" },
      listenerCount: 0,
      speakers: [],
    };
    rooms.set(room.id, room);
    return room;
  }),
  createMockRoute("GET", "/api/v1/spaces/:spaceId", ({ params }) => {
    const room = find(params.spaceId!);
    return {
      ...room,
      viewerRole: isHost(room) ? "host" : "listener",
      viewerJoined: joined.get(room.id)?.has(getSignedInMockUser().id) ?? false,
      pendingSpeakerRequests: isHost(room) ? (requests.get(room.id) ?? []) : [],
    };
  }),
  createMockRoute("POST", "/api/v1/spaces/:spaceId/join", ({ params }) => {
    const room = find(params.spaceId!);
    if (room.state !== "live")
      throw new ApiError(409, "This Space is not live.", "SPACE_NOT_LIVE");
    const users = joined.get(room.id) ?? new Set<string>();
    const id = getSignedInMockUser().id;
    if (!users.has(id)) {
      users.add(id);
      if (!isHost(room)) room.listenerCount++;
    }
    joined.set(room.id, users);
    return {
      spaceId: room.id,
      role: isHost(room) ? "host" : "listener",
      token: "",
      url: "",
      canPublish: isHost(room),
      demo: true,
    } satisfies SpaceGrant;
  }),
  createMockRoute("POST", "/api/v1/spaces/:spaceId/leave", ({ params }) => {
    const room = find(params.spaceId!);
    if (joined.get(room.id)?.delete(getSignedInMockUser().id) && !isHost(room))
      room.listenerCount = Math.max(0, room.listenerCount - 1);
  }),
  ...(["start", "end", "cancel"] as const).map((action) =>
    createMockRoute(
      "POST",
      `/api/v1/spaces/:spaceId/${action}`,
      ({ params }) => {
        const room = find(params.spaceId!);
        requireHost(room);
        const target =
          action === "start"
            ? "live"
            : action === "end"
              ? "ended"
              : "cancelled";
        if (room.state === target) return room;
        if (
          action === "start" || action === "cancel"
            ? room.state !== "scheduled"
            : room.state !== "live"
        )
          throw new ApiError(
            409,
            "This Space cannot change state.",
            "SPACE_STATE_CONFLICT",
          );
        room.state = target;
        return room;
      },
    ),
  ),
  createMockRoute(
    "POST",
    "/api/v1/spaces/:spaceId/speaker-requests",
    ({ params }) => {
      const room = find(params.spaceId!);
      if (
        room.state !== "live" ||
        !joined.get(room.id)?.has(getSignedInMockUser().id)
      )
        throw new ApiError(409, "Join this Space first.", "SPACE_NOT_JOINED");
      const list = requests.get(room.id) ?? [];
      const user = getSignedInMockUser();
      if (!list.some((item) => item.user.id === user.id))
        list.push({
          id: `request_${user.id}`,
          user: { ...user, role: "listener" },
        });
      requests.set(room.id, list);
      return { state: "pending" };
    },
  ),
  ...(["approve", "decline"] as const).map((action) =>
    createMockRoute(
      "POST",
      `/api/v1/spaces/:spaceId/speaker-requests/:requestId/${action}`,
      ({ params }) => {
        const room = find(params.spaceId!);
        requireHost(room);
        const list = requests.get(room.id) ?? [];
        const item = list.find((item) => item.id === params.requestId);
        if (action === "approve" && item)
          room.speakers = [
            ...(room.speakers ?? []),
            { ...item.user, role: "speaker" },
          ];
        requests.set(
          room.id,
          list.filter((item) => item.id !== params.requestId),
        );
      },
    ),
  ),
];
