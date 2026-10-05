export interface DownloadPermissionInput {
  readonly viewerId: string | undefined;
  readonly authorId: string;
  readonly kind: "post" | "clip" | "story";
  readonly visibility: "public" | "subscribers";
  readonly moderationVisibility: string;
  readonly hasMedia: boolean;
  readonly authorAllowsDownloads: boolean;
  readonly authorIsPrivate: boolean;
}

export type DownloadPermission =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly code: string; readonly message: string };

const refuse = (code: string, message: string): DownloadPermission => ({ allowed: false, code, message });

export function decidePostDownloadPermission(input: DownloadPermissionInput): DownloadPermission {
  if (!input.hasMedia) return refuse("NO_DOWNLOADABLE_MEDIA", "This post has no photo or video to download.");
  if (input.viewerId === undefined) return refuse("SIGN_IN_TO_DOWNLOAD", "Sign in to download.");
  if (input.viewerId === input.authorId) return { allowed: true };
  if (input.moderationVisibility !== "visible") return refuse("POST_NOT_AVAILABLE", "This post isn't available to download.");
  if (input.kind === "story") return refuse("STORY_DOWNLOADS_OFF", "Stories can't be downloaded.");
  if (input.visibility === "subscribers") return refuse("SUBSCRIBERS_ONLY", "Subscriber-only posts can't be downloaded.");
  if (input.authorIsPrivate) return refuse("PRIVATE_ACCOUNT", "Posts from private accounts can't be downloaded.");
  if (!input.authorAllowsDownloads) return refuse("DOWNLOADS_DISABLED", "The creator has turned off downloads.");
  return { allowed: true };
}
