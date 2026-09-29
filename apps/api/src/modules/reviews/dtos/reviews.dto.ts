import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";

export interface ReviewDto {
  readonly id: string;
  readonly productId: string;
  readonly storeId: string;
  readonly rating: number;
  readonly text: string;
  readonly author: UserSummary | null;
  readonly reply: string | null;
  readonly repliedAt: string | null;
  readonly createdAt: string;
}
