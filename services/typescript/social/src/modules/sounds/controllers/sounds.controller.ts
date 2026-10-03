import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { PostView } from "../../posts/models/post.model.js";
import type { CreateSoundCommand } from "../commands/createSound/createSound.command.js";
import type { SaveSoundCommand } from "../commands/saveSound/saveSound.command.js";
import type { UnsaveSoundCommand } from "../commands/unsaveSound/unsaveSound.command.js";
import type { UpdateSoundCommand } from "../commands/updateSound/updateSound.command.js";
import type { SoundView } from "../models/sound.model.js";
import type { GetSoundQuery } from "../queries/getSound/getSound.query.js";
import type { ListSoundClipsQuery } from "../queries/listSoundClips/listSoundClips.query.js";
import type { ListSoundsQuery } from "../queries/listSounds/listSounds.query.js";
import { createSoundBodySchema, listSoundsQuerySchema, soundParamsSchema, updateSoundBodySchema } from "../validators/sounds.validator.js";

export interface SoundsHandlers {
  readonly createSound: Handler<CreateSoundCommand, SoundView>;
  readonly updateSound: Handler<UpdateSoundCommand, SoundView>;
  readonly saveSound: Handler<SaveSoundCommand, void>;
  readonly unsaveSound: Handler<UnsaveSoundCommand, void>;
  readonly listSounds: Handler<ListSoundsQuery, Page<SoundView>>;
  readonly getSound: Handler<GetSoundQuery, SoundView>;
  readonly listSoundClips: Handler<ListSoundClipsQuery, Page<PostView>>;
}

export function createSoundsController(route: RouteFactory, handlers: SoundsHandlers) {
  const list = (scope: ListSoundsQuery["scope"], authentication: "required" | "optional") =>
    route({ authentication, query: listSoundsQuerySchema }, ({ principal, query }) => handlers.listSounds({ viewerId: principal?.accountId, scope, term: query.q ?? "", cursor: query.cursor, limit: clampPageSize(query.limit, 20) }));
  return {
    search: list("search", "optional"),
    trending: list("trending", "optional"),
    saved: list("saved", "required"),
    create: route({ authentication: "required", body: createSoundBodySchema, successStatus: 201 }, ({ principal, body }) =>
      handlers.createSound({ ownerId: principal.accountId, title: body.title, audioUrl: body.audioUrl, coverUrl: body.coverUrl, sourceClipId: body.sourceClipId, allowReuse: body.allowReuse ?? true })),
    get: route({ authentication: "optional", params: soundParamsSchema }, ({ principal, params }) => handlers.getSound({ viewerId: principal?.accountId, soundId: params.soundId })),
    clips: route({ authentication: "optional", params: soundParamsSchema, query: listSoundsQuerySchema }, ({ principal, params, query }) =>
      handlers.listSoundClips({ viewerId: principal?.accountId, soundId: params.soundId, cursor: query.cursor, limit: clampPageSize(query.limit, 12) })),
    update: route({ authentication: "required", params: soundParamsSchema, body: updateSoundBodySchema }, ({ principal, params, body }) =>
      handlers.updateSound({ viewerId: principal.accountId, soundId: params.soundId, title: body.title, allowReuse: body.allowReuse })),
    save: route({ authentication: "required", params: soundParamsSchema }, ({ principal, params }) => handlers.saveSound({ userId: principal.accountId, soundId: params.soundId })),
    unsave: route({ authentication: "required", params: soundParamsSchema }, ({ principal, params }) => handlers.unsaveSound({ userId: principal.accountId, soundId: params.soundId })),
  };
}
