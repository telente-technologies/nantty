export interface RegisterDeviceTokenCommand {
  readonly userId: string;
  readonly token: string;
  readonly platform: "ios" | "android" | "web";
  readonly provider?: "expo" | "fcm";
}
