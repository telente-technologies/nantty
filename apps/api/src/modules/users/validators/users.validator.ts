import { schema, type Infer } from "@zudojs/schema";

import { MIN_SELECTED_TOPICS } from "../../../constants/security.constant.js";
import { NOTIFICATION_CATEGORIES } from "../models/users.model.js";

const imageUrl = schema.string().url().max(2048);

export const UpdateProfileBodySchema = schema.object({
  name: schema.string().max(80).optional(),
  bio: schema.string().max(280).optional(),
  username: schema.string().min(3).max(30).regex(/^[A-Za-z0-9_.]+$/).optional(),
  avatarUrl: schema.optional(schema.nullable(imageUrl)),
  bannerUrl: schema.optional(schema.nullable(imageUrl)),
});

const notificationPreferenceShape = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map((category) => [category, schema.boolean().optional()]),
) as Record<(typeof NOTIFICATION_CATEGORIES)[number], ReturnType<typeof schema.boolean>>;

export const UpdateSettingsBodySchema = schema.object({
  theme: schema.enum(["system", "light", "dark"]).optional(),
  language: schema.string().min(2).max(10).optional(),
  notifications: schema.object(notificationPreferenceShape).partial().optional(),
});

export const SaveTopicsBodySchema = schema.object({
  topicIds: schema.array(schema.string().uuid()).min(MIN_SELECTED_TOPICS).max(20),
});

export const AddressBodySchema = schema.object({
  label: schema.string().max(40).optional(),
  fullName: schema.string().min(2).max(120),
  phone: schema.string().min(7).max(20),
  line1: schema.string().min(3).max(200),
  line2: schema.string().max(200).optional(),
  city: schema.string().min(2).max(80),
  state: schema.string().min(2).max(80),
  country: schema.string().length(2).optional(),
  postalCode: schema.string().max(20).optional(),
  isDefault: schema.boolean().optional(),
});

export const UpdateAddressBodySchema = AddressBodySchema.partial();

export const IdParamsSchema = schema.object({ id: schema.string().uuid() });

export const UsernameParamsSchema = schema.object({ username: schema.string().min(3).max(30) });

export type UpdateProfileBody = Infer<typeof UpdateProfileBodySchema>;
export type UpdateSettingsBody = Infer<typeof UpdateSettingsBodySchema>;
export type AddressBody = Infer<typeof AddressBodySchema>;
export type UpdateAddressBody = Infer<typeof UpdateAddressBodySchema>;
