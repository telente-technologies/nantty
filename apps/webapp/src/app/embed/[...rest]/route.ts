import { respondWithUnframeableNotFound } from "@/server/embed/embedNotFound.service";

export function GET(): Response {
  return respondWithUnframeableNotFound();
}
