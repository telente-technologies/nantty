export interface ListNotificationsQuery {
  readonly userId: string;
  readonly filter: "all" | "mentions";
  readonly limit: number;
  readonly cursor: string | null;
}
