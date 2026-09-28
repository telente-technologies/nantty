import type { User, UserSummary } from "@/types";

export const isoDateHoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export const me: User = {
  id: "u_me",
  name: "Enyo Dev",
  username: "enyodev",
  avatarUrl: null,
  verified: true,
  bio: "Bio about the user in this space",
  bannerUrl: null,
  email: "testzudomart@yahoo.com",
  phone: null,
  followers: 300,
  following: 300,
  posts: 300,
  joinedAt: "2025-10-01T00:00:00.000Z",
  isSeller: true,
  storeId: "s_1",
};

export const buildMockUserSummary = (i: number, name = "Username"): UserSummary => ({
  id: `u_${i}`,
  name,
  username: `username${i}`,
  avatarUrl: null,
  verified: i % 3 === 0,
});
