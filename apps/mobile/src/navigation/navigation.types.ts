import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: { mode?: "signup" | "login" };
  Welcome: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { identifier: string };
  SignUpContact: undefined;
  VerifyOtp: { destination: string; purpose: "signup" | "reset" | "login" };
  SignUpBirthday: undefined;
  SignUpPassword: undefined;
  SignUpUsername: undefined;
  Personalization: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Clips: { startId?: string } | undefined;
  Create: undefined;
  Chats: undefined;
  Me: undefined;
};

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Search: { scope?: "all" | "mart" | "messages" } | undefined;
  Notifications: undefined;
  Category: { categoryId: string; name: string; collection?: "sales_of_the_day" | "featured_brands" | "new_arrivals" };
  ProductDetail: { productId: string };
  ProductReviews: { productId: string };
  Store: { storeId: string };
  Cart: undefined;
  Checkout: undefined;
  Payment: { orderId: string; authorizationUrl?: string };
  OrderSuccess: { orderId: string };
  Orders: undefined;
  OrderDetail: { orderId: string };
  OpenDispute: { orderId: string };
  UserProfile: { userId: string };
  EditProfile: undefined;
  Connections: { userId: string; tab?: "followers" | "following" | "shopped" | "suggested" | "blocked" };
  Settings: undefined;
  SettingsAccount: undefined;
  SettingsSecurity: undefined;
  SettingsNotifications: undefined;
  SettingsAppPreference: undefined;
  SettingsPaymentMethods: undefined;
  ShippingAddresses: undefined;
  AddressForm: { addressId?: string } | undefined;
  SettingsSupport: undefined;
  SettingsAbout: undefined;
  ChangePassword: undefined;
  BlockedUsers: undefined;
  Wallet: undefined;
  Transactions: undefined;
  Withdraw: undefined;
  PayoutAccounts: undefined;
  SellerApplication: undefined;
  SellerDashboard: undefined;
  SellerProducts: undefined;
  ProductForm: { productId?: string } | undefined;
  SellerOrders: undefined;
  SellerOrderDetail: { orderId: string };
  Chat: { conversationId?: string; userId?: string; name: string };
  NewMessage: undefined;
  NewGroup: { kind: "group" | "channel" };
  ConversationInfo: { conversationId: string };
  CreatePost: { mode?: "story" | "post" | "product" | "live" } | undefined;
  PostDetail: { postId: string };
  Live: { liveId: string; host?: boolean };
  LiveEnded: { liveId: string };
  Story: { userId: string };
  EscrowStatus: { orderId: string };
  DisputeDetail: { disputeId: string };
  SellerApplicationStatus: undefined;
  CreatorProgram: undefined;
  CreatorApplication: undefined;
  CreatorApplicationStatus: undefined;
  CreatorDashboard: undefined;
  Referral: undefined;
  CreatorSubscribe: { creatorId: string };
  Verification: undefined;
  VerificationApply: { color: "blue" | "gold" };
  PromotePost: { postId: string };
  BoostStatus: { boostId: string };
  SupportTickets: undefined;
  NewSupportTicket: undefined;
  SupportTicketDetail: { ticketId: string };
  MyReports: undefined;
  SettingsUsername: undefined;
};

export type RootStackParamList = AuthStackParamList & MainStackParamList;

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;
export type MainScreenProps<T extends keyof MainStackParamList> = NativeStackScreenProps<MainStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
