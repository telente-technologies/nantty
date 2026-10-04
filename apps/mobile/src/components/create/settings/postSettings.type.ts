import type { PostLocationTag, UserSummary } from "@/types";

import type { PostAudienceSettingsValue } from "../postAudienceSettings";

export interface PostSettingsValue {
  readonly audienceSettings: PostAudienceSettingsValue;
  readonly isAiGenerated: boolean;
  readonly location: PostLocationTag | null;
  readonly tagged: readonly UserSummary[];
}

export const DEFAULT_POST_SETTINGS: PostSettingsValue = {
  audienceSettings: { replyPolicy: "everyone", visibility: "public", sensitiveLabels: [] },
  isAiGenerated: false,
  location: null,
  tagged: [],
};

export const buildPostSettingsFields = (value: PostSettingsValue) => ({
  replyPolicy: value.audienceSettings.replyPolicy,
  visibility: value.audienceSettings.visibility,
  ...(value.isAiGenerated ? { isAiGenerated: true } : {}),
  ...(value.audienceSettings.sensitiveLabels.length > 0 ? { sensitiveLabels: value.audienceSettings.sensitiveLabels } : {}),
  ...(value.location ? { location: value.location } : {}),
  ...(value.tagged.length > 0 ? { taggedUserIds: value.tagged.map((user) => user.id) } : {}),
});
