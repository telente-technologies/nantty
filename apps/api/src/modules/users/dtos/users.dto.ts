import { Role } from "../../../constants/roles.constant.js";
import type { AddressRecord, TopicRecord, UserRecord, UserSettings } from "../models/users.model.js";

export interface CurrentUserDto {
  readonly id: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly username: string;
  readonly name: string;
  readonly bio: string;
  readonly avatarUrl: string | null;
  readonly bannerUrl: string | null;
  readonly birthday: string | null;
  readonly roles: readonly string[];
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
  readonly hasPassword: boolean;
  readonly settings: UserSettings;
  readonly createdAt: string;
}

export interface PublicUserDto {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly bio: string;
  readonly avatarUrl: string | null;
  readonly bannerUrl: string | null;
  readonly isSeller: boolean;
  readonly createdAt: string;
}

export interface AddressDto extends Omit<AddressRecord, "phoneEncrypted" | "userId" | "createdAt"> {
  readonly phone: string;
}

export function convertUserToCurrentUserDto(user: UserRecord): CurrentUserDto {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    username: user.username,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    birthday: user.birthday === null ? null : user.birthday.toISOString().slice(0, 10),
    roles: user.roles,
    emailVerified: user.emailVerifiedAt !== null,
    phoneVerified: user.phoneVerifiedAt !== null,
    hasPassword: user.passwordHash !== null,
    settings: user.settings,
    createdAt: user.createdAt.toISOString(),
  };
}

export function convertUserToPublicUserDto(user: UserRecord): PublicUserDto {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    isSeller: user.roles.includes(Role.SELLER),
    createdAt: user.createdAt.toISOString(),
  };
}

export function convertAddressToDto(address: AddressRecord, phone: string): AddressDto {
  const { phoneEncrypted: _encrypted, userId: _owner, createdAt: _created, ...visible } = address;
  return { ...visible, phone };
}

export function convertTopicToDto(topic: TopicRecord): { readonly id: string; readonly slug: string; readonly name: string } {
  return { id: topic.id, slug: topic.slug, name: topic.name };
}
