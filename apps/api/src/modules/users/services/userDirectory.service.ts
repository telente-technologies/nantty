import { Role } from "../../../constants/roles.constant.js";
import type { UserAccountStanding, UserAccountStandingLookup, UserContact, UserDirectory, UserLocalePreference, UserSummary } from "../../../interfaces/userDirectory.interface.js";
import type { UserRecord } from "../models/users.model.js";
import type { TopicsRepository } from "../repositories/topics.repository.js";
import type { UsersRepository } from "../repositories/users.repository.js";

export function convertUserToSummary(user: UserRecord): UserSummary {
  return { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl, isSeller: user.roles.includes(Role.SELLER) };
}

export class RepositoryUserDirectory implements UserDirectory, UserAccountStandingLookup {
  public constructor(private readonly users: UsersRepository, private readonly topics: TopicsRepository) {}

  public async findUserSummaries(userIds: readonly string[]): Promise<readonly UserSummary[]> {
    const users = await this.users.findManyByIds([...new Set(userIds)]);
    return users.filter((user) => user.status === "active").map(convertUserToSummary);
  }

  public async findUserLocalePreference(userId: string): Promise<UserLocalePreference | undefined> {
    const user = await this.users.findById(userId);
    return user === undefined ? undefined : { countryCode: user.settings.countryCode, currency: user.settings.currency };
  }

  public async findUserContact(userId: string): Promise<UserContact | undefined> {
    const user = await this.users.findById(userId);
    if (user === undefined || user.status !== "active") return undefined;
    return { id: user.id, email: user.emailVerifiedAt === null ? null : user.email, name: user.name, notificationPreferences: user.settings.notifications };
  }

  public async findUserAccountStanding(userId: string): Promise<UserAccountStanding | undefined> {
    const user = await this.users.findById(userId);
    if (user === undefined) return undefined;
    return { userId: user.id, createdAt: user.createdAt, emailVerified: user.emailVerifiedAt !== null, phoneVerified: user.phoneVerifiedAt !== null, active: user.status === "active" };
  }

  public async searchUsers(term: string, limit: number): Promise<readonly UserSummary[]> {
    const page = await this.users.searchByNameOrUsername(term, { limit });
    return page.data.map(convertUserToSummary);
  }

  public async grantRole(userId: string, role: string): Promise<void> {
    await this.users.addRole(userId, role);
  }

  public async listSelectedTopicSlugs(userId: string): Promise<readonly string[]> {
    return (await this.topics.listSelectedTopicsForUser(userId)).map((topic) => topic.slug);
  }

  public async findTopicSlugById(topicId: string): Promise<string | undefined> {
    const [topic] = await this.topics.findManyByIds([topicId]);
    return topic?.slug;
  }
}
