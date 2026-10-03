import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";

export interface SoundView {
  readonly id: string;
  readonly title: string;
  readonly owner: UserSummary;
  readonly isOriginal: boolean;
  readonly allowReuse: boolean;
  readonly status: "available" | "under_copyright_review" | "removed";
  readonly usageCount: number;
  readonly audioUrl: string | null;
  readonly coverUrl: string | null;
  readonly sourceClipId: string | null;
  readonly savedByViewer: boolean;
}
