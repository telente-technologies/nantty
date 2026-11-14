export const interactiveNotificationActionIds = ["NANTTY_REPLY", "NANTTY_MARK_READ"] as const;

export function shouldExecuteInteractiveNotificationAction(actionIdentifier: string, enabled: boolean): boolean {
  return enabled && (interactiveNotificationActionIds as readonly string[]).includes(actionIdentifier);
}
