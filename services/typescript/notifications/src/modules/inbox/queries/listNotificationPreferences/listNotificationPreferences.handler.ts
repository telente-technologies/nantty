import { defaultEmailEnabledByCategory, defaultPushEnabledByCategory, lockedPreferenceCategories, preferenceCategories } from "../../../../constants/notificationCategories.constant.js";
import type { PreferenceRepository } from "../../../../interfaces/repositories.interface.js";
import type { ListNotificationPreferencesQuery } from "./listNotificationPreferences.query.js";

export interface PreferenceResponse {
  readonly category: string;
  readonly push: boolean;
  readonly email: boolean;
  readonly locked: boolean;
}

export class ListNotificationPreferencesHandler {
  public constructor(private readonly preferences: PreferenceRepository) {}

  public async execute(query: ListNotificationPreferencesQuery): Promise<{ readonly data: readonly PreferenceResponse[]; readonly nextCursor: null }> {
    const stored = new Map((await this.preferences.list(query.userId)).map((row) => [row.category, row]));
    const data = preferenceCategories.map((category) => {
      const locked = lockedPreferenceCategories.has(category);
      const row = stored.get(category);
      return {
        category,
        push: locked ? true : (row?.push ?? defaultPushEnabledByCategory[category]),
        email: locked ? true : (row?.email ?? defaultEmailEnabledByCategory[category]),
        locked,
      };
    });
    return { data, nextCursor: null };
  }
}
