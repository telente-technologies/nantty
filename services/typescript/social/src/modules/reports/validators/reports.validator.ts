import { schema } from "@zudojs/schema";

import { acceptedReportReasons, reportTargetTypes } from "../services/reportReasons.service.js";

export const submitReportBodySchema = schema.object({
  targetType: schema.enum([...reportTargetTypes]),
  targetId: schema.string().min(1).max(100),
  conversationId: schema.string().uuid().optional(),
  reportedUserId: schema.string().uuid().optional(),
  reason: schema.enum(acceptedReportReasons),
  details: schema.string().max(500).optional(),
  blockReportedUser: schema.boolean().optional(),
  evidence: schema.array(schema.record(schema.unknown())).max(100).optional(),
  evidenceSelection: schema.string().max(40).optional(),
  evidenceHash: schema.string().max(128).optional(),
  liveContext: schema.object({
    offsetSeconds: schema.number().min(0).max(86_400).optional(),
    frameRef: schema.string().max(512).optional(),
    capturedAt: schema.string().max(40).optional(),
  }).optional(),
});
