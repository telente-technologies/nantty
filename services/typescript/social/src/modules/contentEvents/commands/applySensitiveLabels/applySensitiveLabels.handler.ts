import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { applySensitiveLabelChange } from "../../../posts/services/sensitiveLabelWrite.service.js";
import { normaliseSensitiveLabels } from "../../../posts/services/sensitiveContent.service.js";
import type { ApplySensitiveLabelsCommand } from "./applySensitiveLabels.command.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createApplySensitiveLabelsHandler(context: HandlerContext): Handler<ApplySensitiveLabelsCommand, boolean> {
  return async ({ targetType, targetId, source, labels, occurredAt }) => {
    if ((targetType !== "post" && targetType !== "clip") || !uuidPattern.test(targetId)) return false;
    return applySensitiveLabelChange(context, targetId, { source, labels: normaliseSensitiveLabels(labels) }, occurredAt);
  };
}
