import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createSubmitReportHandler } from "./commands/submitReport/submitReport.handler.js";
import { createReportsController } from "./controllers/reports.controller.js";
import { registerReportsRoutes } from "./routes/reports.routes.js";

export function mountReportsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerReportsRoutes(router, createReportsController(route, { submitReport: createSubmitReportHandler(context) }));
}
