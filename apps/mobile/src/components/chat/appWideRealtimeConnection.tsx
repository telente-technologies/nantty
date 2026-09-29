import { useRealtimeMessagingConnection } from "./realtimeMessaging.hook";

export function KeepRealtimeMessagingConnectedWhileSignedIn() {
  useRealtimeMessagingConnection();
  return null;
}
