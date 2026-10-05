import { z } from "zod";

export const emailPreviewThemeSchema = z.enum(["light", "dark"]).catch("light");

export const policyUpdatedPreviewBodySchema = z.strictObject({
  theme: z.enum(["light", "dark"]).default("light"),
  documentTitle: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(150),
  summaryText: z.string().trim().min(1).max(2000),
  whatChanged: z.array(z.string().max(300)).max(50).transform((lines) => lines.map((line) => line.trim()).filter(Boolean).slice(0, 12)),
  effectiveAt: z.string().trim().max(40).refine((value) => !Number.isNaN(Date.parse(value)), "effectiveAt must be a date."),
  reacceptNote: z.string().trim().max(600).nullish().transform((value) => (value === undefined || value === null || value === "" ? null : value)),
  documentUrl: z.string().trim().max(500).regex(/^https:\/\//, "documentUrl must be an https link."),
});

export type PolicyUpdatedPreviewBody = z.infer<typeof policyUpdatedPreviewBodySchema>;
