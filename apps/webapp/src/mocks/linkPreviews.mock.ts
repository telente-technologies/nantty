import { mockPostsState } from "./postCatalog.mock";
import { createMockRoute } from "./registry.mock";

export const linkPreviewsMocks = [
  createMockRoute("POST", "/api/v1/posts/:postId/link-preview", ({ params }) => mockPostsState.get(params.postId!)?.linkPreview ?? null),
];
