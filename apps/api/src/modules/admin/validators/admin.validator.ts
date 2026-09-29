import { schema, type Infer } from "@zudojs/schema";

const challengeToken = schema.string().min(20).max(200);
const totpCode = schema.string().regex(/^\d{6}$/);
const recoveryCode = schema.string().min(8).max(20);
const permissionList = schema.array(schema.string().min(3).max(60)).max(100);
const ipAllowList = schema.array(schema.string().min(2).max(64)).max(50);

export const AdminLoginBodySchema = schema.object({ identifier: schema.string().min(3).max(254), password: schema.string().min(1).max(128) });

export const AdminChallengeBodySchema = schema.object({ challengeToken });

export const AdminCompleteLoginBodySchema = schema.object({ challengeToken, code: totpCode.optional(), recoveryCode: recoveryCode.optional() });

export const AdminStepUpBodySchema = schema.object({ code: totpCode.optional(), recoveryCode: recoveryCode.optional() });

export const CreateStaffAccountBodySchema = schema.object({
  userId: schema.string().uuid().optional(),
  email: schema.string().email().max(254).optional(),
  role: schema.enum(["admin", "support", "superadmin"]),
  permissions: permissionList.optional(),
  ipAllowList: ipAllowList.optional(),
});

export const UpdateStaffAccountBodySchema = schema.object({
  role: schema.enum(["admin", "support", "superadmin"]).optional(),
  permissions: permissionList.optional(),
  ipAllowList: ipAllowList.optional(),
});

export const StaffAccountParamsSchema = schema.object({ userId: schema.string().uuid() });

export const WebAuthnCredentialParamsSchema = schema.object({ id: schema.string().uuid() });

export type AdminCompleteLoginBody = Infer<typeof AdminCompleteLoginBodySchema>;
export type AdminStepUpBody = Infer<typeof AdminStepUpBodySchema>;
export type CreateStaffAccountBody = Infer<typeof CreateStaffAccountBodySchema>;
export type UpdateStaffAccountBody = Infer<typeof UpdateStaffAccountBodySchema>;
