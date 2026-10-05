import type { HttpRouterContext } from "@zudojs/http";

import type { TicketCategory } from "../../../enums/ticket.enum.js";
import { badRequest, notFound } from "../../../errors/support.error.js";
import type { MacroRecord } from "../../../types/ticket.type.js";
import { empty, json, parseJsonBody, parseWithSchema } from "../../../utils/http.util.js";
import type { StaffAccess } from "../services/staffAccess.service.js";
import type { TicketModuleDependencies } from "../tickets.module.js";
import { macroBodySchema } from "../validators/ticket.validator.js";
import { readPermissions } from "./staffTickets.controller.js";

const macroReadPermissions = [...readPermissions, "support:chat"] as const;

export const macroVariables = ["user.displayName", "user.username", "ticket.id", "agent.name"] as const;

const presentMacro = (macro: MacroRecord) => ({ id: macro.id, title: macro.title, body: macro.body, category: macro.category?.toUpperCase() ?? null, updatedAt: macro.updatedAt.toISOString(), updatedByName: macro.updatedByName });

function readMacroInput(raw: unknown, editorName: string) {
  const body = parseWithSchema(macroBodySchema, raw);
  const unknown = [...body.body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((match) => match[1] ?? "").filter((name) => !(macroVariables as readonly string[]).includes(name));
  if (unknown.length > 0) throw badRequest("VALIDATION_FAILED", `Unknown variables: ${unknown.join(", ")}`);
  return { title: body.title, body: body.body, category: (body.category?.toLowerCase() ?? null) as TicketCategory | null, updatedByName: editorName };
}

export function createMacrosController(dependencies: TicketModuleDependencies, access: StaffAccess) {
  return {
    list: async (context: HttpRouterContext) => {
      await access.require(context, macroReadPermissions);
      return json(200, { items: (await dependencies.store.listMacros()).map(presentMacro), variables: macroVariables.map((name) => `{{${name}}}`) });
    },
    create: async (context: HttpRouterContext) => {
      const staff = await access.require(context, ["support:assign"]);
      return json(201, presentMacro(await dependencies.store.createMacro(readMacroInput(parseJsonBody(context.request.body), staff.name))));
    },
    update: async (context: HttpRouterContext) => {
      const staff = await access.require(context, ["support:assign"]);
      const updated = await dependencies.store.updateMacro(context.params["macroId"] ?? "", readMacroInput(parseJsonBody(context.request.body), staff.name));
      if (updated === null) throw notFound("Macro");
      return json(200, presentMacro(updated));
    },
    remove: async (context: HttpRouterContext) => {
      await access.require(context, ["support:assign"]);
      if (!(await dependencies.store.deleteMacro(context.params["macroId"] ?? ""))) throw notFound("Macro");
      return empty(204);
    },
  };
}
