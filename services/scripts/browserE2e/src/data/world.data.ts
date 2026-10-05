import { createPublicPost, seedStoreWithProduct, type SeededStore } from "./commerce.data.js";
import { registerUser, uniqueSuffix, type UserActor } from "../smokeBridge.js";

export interface GuestWorld {
  readonly store: SeededStore;
  readonly author: UserActor;
  readonly postId: string;
  readonly postText: string;
  readonly visitor: UserActor;
}

export async function seedGuestWorld(): Promise<GuestWorld> {
  const store = await seedStoreWithProduct("guest");
  const author = store.seller;
  const postText = `E2E public post ${uniqueSuffix()}`;
  const postId = await createPublicPost(author, postText);
  const visitor = await registerUser("visitor");
  return { store, author, postId, postText, visitor };
}
