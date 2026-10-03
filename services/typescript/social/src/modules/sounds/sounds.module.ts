import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createCreateSoundHandler } from "./commands/createSound/createSound.handler.js";
import { createSaveSoundHandler } from "./commands/saveSound/saveSound.handler.js";
import { createUnsaveSoundHandler } from "./commands/unsaveSound/unsaveSound.handler.js";
import { createUpdateSoundHandler } from "./commands/updateSound/updateSound.handler.js";
import { createSoundsController } from "./controllers/sounds.controller.js";
import { createGetSoundHandler } from "./queries/getSound/getSound.handler.js";
import { createListSoundClipsHandler } from "./queries/listSoundClips/listSoundClips.handler.js";
import { createListSoundsHandler } from "./queries/listSounds/listSounds.handler.js";
import { registerSoundsRoutes } from "./routes/sounds.routes.js";

export function mountSoundsModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerSoundsRoutes(router, createSoundsController(route, {
    createSound: createCreateSoundHandler(context),
    updateSound: createUpdateSoundHandler(context),
    saveSound: createSaveSoundHandler(context),
    unsaveSound: createUnsaveSoundHandler(context),
    listSounds: createListSoundsHandler(context),
    getSound: createGetSoundHandler(context),
    listSoundClips: createListSoundClipsHandler(context),
  }));
}
