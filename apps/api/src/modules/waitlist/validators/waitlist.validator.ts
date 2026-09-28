import { schema, type Infer } from "@zudojs/schema";

export const JoinWaitlistBodySchema = schema.object({
  email: schema.string().email().max(254),
  name: schema.string().max(80).optional(),
  role: schema.enum(["buyer", "seller"]).optional(),
  source: schema.string().max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
});

export type JoinWaitlistBody = Infer<typeof JoinWaitlistBodySchema>;
