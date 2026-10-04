export interface NotificationPreference {
  readonly category: string;
  readonly push: boolean;
  readonly email: boolean;
  readonly locked: boolean;
}
