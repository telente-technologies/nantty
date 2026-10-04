import { forbidden } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { currentViewerAgeBracket } from "../../../../utils/viewerAgeContext.util.js";
import type { ContentPreferencesView } from "../../models/contentPreferences.model.js";
import type { UpdateContentPreferencesCommand } from "./updateContentPreferences.command.js";

export function createUpdateContentPreferencesHandler(context: HandlerContext): Handler<UpdateContentPreferencesCommand, ContentPreferencesView> {
  return async ({ accountId, showSensitiveWithoutWarning }) => {
    const ageBracket = currentViewerAgeBracket();
    if (ageBracket !== "adult" && showSensitiveWithoutWarning) throw forbidden("ADULTS_ONLY_SETTING", "Only people 18 or older can turn off sensitive content warnings. Add your birthday in Settings if you haven't.");
    const saved = await context.database.client.contentPreference.upsert({
      where: { accountId },
      create: { accountId, showSensitiveWithoutWarning },
      update: { showSensitiveWithoutWarning },
    });
    return { showSensitiveWithoutWarning: ageBracket === "adult" && saved.showSensitiveWithoutWarning, canChangeSensitiveContentSetting: ageBracket === "adult", ageBracket };
  };
}
