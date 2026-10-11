import { WebappRequestError } from "@/services/clientApi.service";

export interface DeletablePost {
  readonly id: string;
  readonly kind?: string;
}

const nounFor = (kind: string | undefined) => (kind === "clip" ? "clip" : kind === "story" ? "story" : "post");

export function deleteConfirmationCopy(kind: string | undefined) {
  const noun = nounFor(kind);
  return {
    title: `Delete ${noun}?`,
    message: "This can't be undone.",
    deletedToast: `${noun[0]?.toUpperCase()}${noun.slice(1)} deleted`,
    failed: `Couldn't delete this ${noun}. Check your connection and try again.`,
    forbidden: `You can only delete your own ${noun}s.`,
  };
}

export const isAlreadyDeleted = (error: unknown) => error instanceof WebappRequestError && (error.status === 404 || error.status === 410);
