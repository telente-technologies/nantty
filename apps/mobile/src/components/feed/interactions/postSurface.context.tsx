import { createContext, useContext, type ReactNode } from "react";

import type { FeedInteractionSurface } from "@/services/feed/feedInteractions.service";

const PostSurfaceContext = createContext<FeedInteractionSurface>("feed");

export function PostSurfaceProvider({ surface, children }: { readonly surface: FeedInteractionSurface; readonly children: ReactNode }) {
  return <PostSurfaceContext.Provider value={surface}>{children}</PostSurfaceContext.Provider>;
}

export const usePostSurface = () => useContext(PostSurfaceContext);
