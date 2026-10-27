import type { User, UserSummary } from "@/types";

import { directoryUsersExcludingAccounts, findDirectoryUserById, summariseUser } from "./userDirectory.mock";

export const isoDateHoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export const me: User = { ...findDirectoryUserById("u_me")!, email: "testnantty@yahoo.com", phone: "+2348034417720" };

export const demoFanAccount: User = { ...findDirectoryUserById("u_buyer")!, email: "fan.nantty@gmail.com", phone: null };

export const mockSession: { signedInUserId: string } = { signedInUserId: me.id };

export const getSignedInMockUser = (): User => (mockSession.signedInUserId === demoFanAccount.id ? demoFanAccount : me);

export const signedInUserIsTheDemoSeller = () => getSignedInMockUser().id === me.id;

export const buildMockUserSummary = (index: number, _legacyName?: string): UserSummary =>
  summariseUser(directoryUsersExcludingAccounts[Math.abs(index) % directoryUsersExcludingAccounts.length]!);
