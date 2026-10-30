export const viewableModerationVisibilities = ["visible", "restricted"] as const;

export const shownToViewers = { deletedAt: null, moderationVisibility: { in: [...viewableModerationVisibilities] } };

export const publishedPostToViewers = { ...shownToViewers, publicationState: "published" as const };
