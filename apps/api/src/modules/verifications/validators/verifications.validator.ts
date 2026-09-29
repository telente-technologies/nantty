import { schema, type Infer } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";
import { IDENTITY_DOCUMENT_TYPES, PROFILE_TYPES, VERIFICATION_STATUSES, VERIFICATION_TIERS, VERIFICATION_TYPES } from "../models/verifications.model.js";

export const VerificationDetailsBodySchema = schema.object({
  legalName: schema.string().min(2).max(160).optional(),
  businessName: schema.string().min(2).max(160).optional(),
  businessAddress: schema.string().min(5).max(300).optional(),
  registrationNumber: schema.string().min(4).max(40).regex(/^[A-Za-z0-9-]+$/).optional(),
  contactPhone: schema.string().min(7).max(20).optional(),
  idType: schema.enum(IDENTITY_DOCUMENT_TYPES).optional(),
  idNumber: schema.string().min(5).max(40).regex(/^[A-Za-z0-9-]+$/).optional(),
  documentMediaIds: schema.array(schema.string().uuid()).max(10).optional(),
});

export const ApplyForVerificationBodySchema = schema.object({
  profileType: schema.enum(PROFILE_TYPES),
  tier: schema.enum(VERIFICATION_TIERS).optional(),
  storeId: schema.string().uuid().optional(),
  details: VerificationDetailsBodySchema.optional(),
});

export const SellerVerificationBodySchema = schema.object({ details: VerificationDetailsBodySchema });

export const MyVerificationQuerySchema = schema.object({
  profileType: schema.enum(PROFILE_TYPES).optional(),
  storeId: schema.string().uuid().optional(),
});

export const StoreScopeQuerySchema = schema.object({ storeId: schema.string().uuid().optional() });

export const ProfileParamsSchema = schema.object({ profileId: schema.string().uuid() });

export const ReviewReasonBodySchema = schema.object({ reason: schema.string().max(500).optional() });

export const ListVerificationsQuerySchema = schema.object({
  status: schema.enum(VERIFICATION_STATUSES).optional(),
  type: schema.enum(VERIFICATION_TYPES).optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export type VerificationDetailsBody = Infer<typeof VerificationDetailsBodySchema>;
