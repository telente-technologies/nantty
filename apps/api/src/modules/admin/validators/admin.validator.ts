import { schema, type Infer } from "@zudojs/schema";

import { AdminPageQuerySchema, AdminReasonSchema } from "../../../utils/adminHttp.util.js";

const mfaToken = schema.string().min(20).max(200);
const totpCode = schema.string().regex(/^\d{6}$/);
const webAuthnCredential = schema.record(schema.unknown());
const permissionKeys = schema.array(schema.string().min(3).max(60)).max(100);

export const AdminLoginBodySchema = schema.object({ email: schema.string().email().max(254), password: schema.string().min(1).max(128) });

export const AdminMfaTokenBodySchema = schema.object({ mfaToken });

export const AdminTotpConfirmBodySchema = schema.object({ mfaToken, code: totpCode });

export const AdminMfaVerifyBodySchema = schema.object({
  mfaToken,
  method: schema.enum(["totp", "recovery", "webauthn"]),
  code: schema.string().min(6).max(20).optional(),
  credential: webAuthnCredential.optional(),
});

export const AdminRefreshBodySchema = schema.object({ refreshToken: schema.string().min(20).max(8192) });

export const AdminStepUpBodySchema = schema.object({
  method: schema.enum(["totp", "webauthn"]),
  code: totpCode.optional(),
  credential: webAuthnCredential.optional(),
});

export const AdminSessionParamsSchema = schema.object({ sessionId: schema.string().uuid() });

export const AdminPasskeyParamsSchema = schema.object({ passkeyId: schema.string().uuid() });

export const AddPasskeyBodySchema = schema.object({ label: schema.string().min(1).max(60), credential: webAuthnCredential });

export const AdminIdParamsSchema = schema.object({ adminId: schema.string().uuid() });

export const ListAdminsQuerySchema = AdminPageQuerySchema.extend(schema.object({
  search: schema.string().max(120).optional(),
  status: schema.enum(["ACTIVE", "INVITED", "DISABLED", "LOCKED"]).optional(),
  role: schema.enum(["SUPERADMIN", "ADMIN", "SUPPORT"]).optional(),
}));

export const InviteAdminBodySchema = schema.object({
  email: schema.string().email().max(254),
  name: schema.string().min(2).max(80),
  role: schema.enum(["ADMIN", "SUPPORT"]),
  permissions: permissionKeys,
  reason: AdminReasonSchema,
});

export const ChangeAdminPermissionsBodySchema = schema.object({ role: schema.enum(["ADMIN", "SUPPORT"]), permissions: permissionKeys, reason: AdminReasonSchema });

export const InvitationParamsSchema = schema.object({ token: schema.string().min(20).max(200) });

export const AcceptInvitationBodySchema = schema.object({ password: schema.string().min(1).max(128) });

export const AuditLogQuerySchema = AdminPageQuerySchema.extend(schema.object({
  search: schema.string().max(200).optional(),
  area: schema.string().max(60).optional(),
  actorId: schema.string().max(80).optional(),
  targetType: schema.string().max(60).optional(),
  targetId: schema.string().max(120).optional(),
  from: schema.string().datetime().optional(),
  to: schema.string().datetime().optional(),
  format: schema.enum(["csv"]).optional(),
}));

export const AuditEntryParamsSchema = schema.object({ entryId: schema.string().uuid() });

export type AuditLogQuery = Infer<typeof AuditLogQuerySchema>;
