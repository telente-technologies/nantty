import { schema, type Infer } from "@zudojs/schema";

const password = schema.string().min(1).max(128);
const contact = schema.string().min(3).max(254);
const oneTimeCode = schema.string().regex(/^\d{6}$/);
const username = schema.string().min(3).max(30).regex(/^[A-Za-z0-9_.]+$/);

export const RegisterBodySchema = schema.object({
  email: schema.string().email().max(254).optional(),
  phone: schema.string().min(7).max(20).optional(),
  username,
  password,
  birthday: schema.string().date(),
  name: schema.string().max(80).optional(),
});

export const LoginBodySchema = schema.object({ identifier: contact, password });

export const SocialSignInBodySchema = schema.object({
  idToken: schema.string().min(20).max(8192),
  name: schema.string().max(80).optional(),
  username: username.optional(),
});

export const SendOneTimeCodeBodySchema = schema.object({
  target: contact,
  purpose: schema.enum(["verify_contact", "login"]),
});

export const VerifyOneTimeCodeBodySchema = schema.object({
  target: contact,
  purpose: schema.enum(["verify_contact", "login"]),
  code: oneTimeCode,
});

export const ForgotPasswordBodySchema = schema.object({ target: contact });

export const ResetPasswordBodySchema = schema.object({ target: contact, code: oneTimeCode, newPassword: password });

export const RefreshTokenBodySchema = schema.object({ refreshToken: schema.string().min(20).max(8192) });

export const SessionParamsSchema = schema.object({ id: schema.string().uuid() });

export const UsernameAvailabilityQuerySchema = schema.object({ username });

export type RegisterBody = Infer<typeof RegisterBodySchema>;
export type SocialSignInBody = Infer<typeof SocialSignInBodySchema>;
export type SendOneTimeCodeBody = Infer<typeof SendOneTimeCodeBodySchema>;
export type VerifyOneTimeCodeBody = Infer<typeof VerifyOneTimeCodeBodySchema>;
export type ResetPasswordBody = Infer<typeof ResetPasswordBodySchema>;
