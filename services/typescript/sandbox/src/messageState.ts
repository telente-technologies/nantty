export type SandboxMessageStatus = "sent" | "received" | "delivered" | "read" | "failed";
export type SandboxMessageTargetStatus = "delivered" | "read" | "failed";
export type SandboxMessageEventType = "message.delivered" | "message.read" | "message.failed";

export interface SandboxMessageTransition {
  readonly status: SandboxMessageTargetStatus;
  readonly eventType: SandboxMessageEventType | null;
}

const transitionEvents: Record<SandboxMessageTargetStatus, SandboxMessageEventType> = {
  delivered: "message.delivered",
  read: "message.read",
  failed: "message.failed",
};

export function resolveSandboxMessageTransition(
  sender: string,
  currentStatus: string,
  targetStatus: SandboxMessageTargetStatus,
): SandboxMessageTransition | null {
  if (sender !== "business") return null;
  if (currentStatus === targetStatus) return { status: targetStatus, eventType: null };

  const allowed =
    (currentStatus === "sent" && (targetStatus === "delivered" || targetStatus === "failed")) ||
    (currentStatus === "delivered" && targetStatus === "read");

  return allowed ? { status: targetStatus, eventType: transitionEvents[targetStatus] } : null;
}
