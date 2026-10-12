import type { VideoReplyTarget } from "@/components/clips/videoReply/videoReply.util";
import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { SavedItemFilter } from "@/types/saves.type";
import type { SearchScopeKey } from "@/types/search.type";
import type { SupportLinkedReference, SupportTicketCategory } from "@/types/support.type";

export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: { mode?: "signup" | "login"; dismissible?: boolean };
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
  Clips: { startId?: string; commentId?: string } | undefined;
  Create: undefined;
  Chats: undefined;
  Me: undefined;
};

export type MainStackParamList = {
  NotFound: undefined;
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Search: { scope?: SearchScopeKey | "all" | "messages"; scopeLabel?: string } | undefined;
  Notifications: undefined;
  Category: { categoryId: string; name: string; collection?: "sales_of_the_day" | "featured_brands" | "new_arrivals" };
  ProductDetail: { productId: string };
  ProductReviews: { productId: string };
  WriteReview: { productId: string; productName?: string; imageUrl?: string | null };
  Store: { storeId: string };
  Cart: undefined;
  Checkout: undefined;
  Payment: { orderId: string; authorizationUrl?: string };
  OrderSuccess: { orderId: string };
  Orders: undefined;
  OrderDetail: { orderId: string };
  OpenDispute: { orderId: string };
  UserProfile: { userId: string };
  UserProfileByUsername: { username: string };
  EditProfile: undefined;
  Connections: { userId: string; tab?: "followers" | "following" | "shopped" | "suggested" | "blocked" };
  Settings: undefined;
  SettingsAccount: undefined;
  AccountStatus: undefined;
  SettingsSecurity: undefined;
  SettingsNotifications: undefined;
  SettingsAppPreference: undefined;
  SettingsWidgets: undefined;
  SettingsPaymentMethods: undefined;
  ShippingAddresses: undefined;
  AddressForm: { addressId?: string } | undefined;
  SettingsSupport: undefined;
  SettingsAbout: undefined;
  ChangePassword: undefined;
  BlockedUsers: undefined;
  HiddenComments: undefined;
  ChatSettings: undefined;
  ChatNotificationSettings: undefined;
  ChatPasscode: undefined;
  Wallet: undefined;
  Transactions: undefined;
  StoreRewards: undefined;
  CoinActivity: undefined;
  Withdraw: undefined;
  AddMoney: undefined;
  PayoutAccounts: undefined;
  PayoutSetup: { context?: "creator" | "seller" } | undefined;
  SellerApplication: undefined;
  SellerDashboard: undefined;
  SellerProducts: undefined;
  ProductForm: { productId?: string } | undefined;
  SellerOrders: undefined;
  SellerOrderDetail: { orderId: string };
  Chat: { conversationId?: string; userId?: string; storeId?: string; name: string };
  NewMessage: undefined;
  NewGroup: { kind: "group" | "channel" };
  ConversationInfo: { conversationId: string };
  CreatePost: { mode?: "story" | "post" | "clip" | "product" | "live"; soundId?: string; videoReply?: VideoReplyTarget; quotePostId?: string } | undefined;
  PostDetail: { postId: string };
  PostAnalytics: { postId: string };
  PostQuotes: { postId: string };
  CommentThread: { commentId: string; postId: string };
  ContentPreferences: undefined;
  Live: { liveId: string; host?: boolean };
  LiveEnded: { liveId: string };
  Story: { userId: string };
  StoryAnalytics: { storyId: string };
  EscrowStatus: { orderId: string };
  DisputeDetail: { disputeId: string };
  SellerApplicationStatus: undefined;
  CreatorProgram: undefined;
  CreatorApplication: undefined;
  CreatorApplicationStatus: undefined;
  CreatorDashboard: undefined;
  CreatorSubscribe: { creatorId: string };
  MySubscriptions: undefined;
  Verification: undefined;
  VerificationApply: { color: "blue" };
  IdentityVerification: { step?: "pay" } | undefined;
  PromotePost: { postId: string };
  BoostStatus: { boostId: string };
  SupportTickets: undefined;
  NewSupportTicket: { category?: SupportTicketCategory; linkedReference?: SupportLinkedReference } | undefined;
  HelpCenter: undefined;
  HelpArticle: { topicSlug: string };
  HelpCategory: { categorySlug: string; title?: string };
  BusinessDocuments: undefined;
  SupportTicketDetail: { ticketId: string };
  MyReports: undefined;
  SettingsUsername: undefined;
  BrandProfile: { brandId: string };
  CreateBrand: undefined;
  FollowRequests: undefined;
  SettingsPrivacy: undefined;
  SettingsPrivacyData: undefined;
  CreateBusinessProfile: undefined;
  ManageProfiles: undefined;
  Saved: { initialFilter?: SavedItemFilter } | undefined;
  Sound: { soundId: string };
  AuthFlow: { mode?: "signup" | "login" } | undefined;
};

export type RootStackParamList = AuthStackParamList & MainStackParamList;

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;
export type MainScreenProps<T extends keyof MainStackParamList> = NativeStackScreenProps<MainStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
