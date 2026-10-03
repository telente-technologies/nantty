import { schema } from "@zudojs/schema";

export const submitReportBodySchema = schema.object({
  targetType: schema.enum(["user", "message", "conversation", "group", "post", "comment", "clip"]),
  targetId: schema.string().min(1).max(100),
  conversationId: schema.string().uuid().optional(),
  reportedUserId: schema.string().uuid().optional(),
  reason: schema.enum(["child_safety", "self_harm", "violence", "harassment", "hate", "sexual_content", "spam", "fraud", "impersonation", "prohibited_items", "other"]),
  details: schema.string().max(500).optional(),
  blockReportedUser: schema.boolean().optional(),
  evidence: schema.array(schema.record(schema.unknown())).max(100).optional(),
  evidenceSelection: schema.string().max(40).optional(),
  evidenceHash: schema.string().max(128).optional(),
});
