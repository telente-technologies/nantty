import { z } from "zod";

import { isValidIanaTimeZone } from "../../reengagement/services/reengagementPolicy.service.js";

import { preferenceCategories } from "../../../constants/notificationCategories.constant.js";
import { validationError } from "../../../errors/notifications.error.js";

export function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw validationError("Check the highlighted fields.", result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
}

export const listNotificationsQuerySchema = z.object({
  filter: z.enum(["all", "mentions"]).default("all"),
  cursor: z.string().min(1).max(200).nullish().transform((value) => value ?? null),
});

export const updatePreferenceBodySchema = z.strictObject({
  category: z.enum(preferenceCategories as [string, ...string[]]),
  push: z.boolean().optional(),
  email: z.boolean().optional(),
}).refine((value) => value.push !== undefined || value.email !== undefined, { message: "Provide push or email." });

export const registerDeviceTokenBodySchema = z.strictObject({
  token: z.string().min(10).max(300),
  platform: z.enum(["ios", "android", "web"]),
  // Existing clients omit provider and continue to register Expo tokens.
  provider: z.enum(["expo", "fcm"]).default("expo"),
});

export const removeDeviceTokenBodySchema = z.strictObject({ token: z.string().min(10).max(300) });
export const activityHeartbeatBodySchema = z.strictObject({
  timeZone: z.string().min(1).max(64).refine(isValidIanaTimeZone, "timeZone must be a valid IANA timezone."),
});
