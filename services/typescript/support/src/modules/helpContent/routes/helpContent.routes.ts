import type { HttpRouter } from "@nantty/fastify-platform";

import type { createAdminHelpController } from "../controllers/adminHelp.controller.js";
import type { createPublicHelpController } from "../controllers/publicHelp.controller.js";

export function registerHelpContentRoutes(router: HttpRouter, publicHelp: ReturnType<typeof createPublicHelpController>, admin: ReturnType<typeof createAdminHelpController>): void {
  router.get("/api/v1/help/categories", publicHelp.categories);
  router.get("/api/v1/help/categories/:categorySlug", publicHelp.category);
  router.get("/api/v1/help/topics", publicHelp.topics);
  router.get("/api/v1/help/topics/:topicSlug", publicHelp.topic);
  router.post("/api/v1/help/topics/:topicId/votes", publicHelp.vote);
  router.get("/api/v1/admin/help/categories", admin.listCategories);
  router.post("/api/v1/admin/help/categories", admin.createCategory);
  router.put("/api/v1/admin/help/categories/:categoryId", admin.updateCategory);
  router.delete("/api/v1/admin/help/categories/:categoryId", admin.deleteCategory);
  router.get("/api/v1/admin/help/topics", admin.listTopics);
  router.post("/api/v1/admin/help/topics", admin.createTopic);
  router.get("/api/v1/admin/help/topics/:topicId", admin.topic);
  router.put("/api/v1/admin/help/topics/:topicId", admin.updateTopic);
  router.delete("/api/v1/admin/help/topics/:topicId", admin.deleteTopic);
  router.post("/api/v1/admin/help/topics/:topicId/publish", admin.publish);
  router.post("/api/v1/admin/help/topics/:topicId/unpublish", admin.unpublish);
  router.post("/api/v1/admin/help/topics/:topicId/merge", admin.merge);
  router.get("/api/v1/admin/help/auto-topics", admin.autoTopics);
  router.get("/api/v1/admin/help/settings", admin.settings);
  router.put("/api/v1/admin/help/settings", admin.updateSettings);
}
