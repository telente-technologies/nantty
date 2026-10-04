import type { MediaReferenceInput } from "../modules/posts/commands/createPost/createPost.command.js";

export interface MediaDescriptorResolver {
  resolveOwnedMedia(ownerId: string, mediaIds: readonly string[]): Promise<ReadonlyMap<string, MediaReferenceInput>>;
}
