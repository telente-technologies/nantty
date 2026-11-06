import type { LinkingOptions } from "@react-navigation/native";

import { deepLinkPrefixes, readProductIdFromSlug } from "@/config/webAppLinks.config";

import type { RootStackParamList } from "./navigation.types";

const stripAtSign = (value: string) => decodeURIComponent(value).replace(/^@/, "");

export const deepLinking: LinkingOptions<RootStackParamList> = {
  prefixes: [...deepLinkPrefixes],
  config: {
    screens: {
      Tabs: { screens: { Home: "", Clips: { path: "clips/:startId?", parse: { startId: decodeURIComponent } }, Chats: "chats", Me: { path: "me", alias: ["rankings"] } } },
      ProductDetail: { path: "p/:productId", alias: ["product/:productId", "products/:productId"], parse: { productId: readProductIdFromSlug } },
      Store: { path: "store/:storeId", alias: ["stores/:storeId"] },
      PostDetail: { path: "post/:postId", alias: ["posts/:postId"] },
      CommentThread: "post/:postId/comments/:commentId",
      PostAnalytics: "analytics/post/:postId",
      Spaces: { path: "spaces/:spaceId?", parse: { spaceId: decodeURIComponent } },
      Live: { path: "live/:liveId", alias: ["lives/:liveId"], parse: { liveId: decodeURIComponent }, stringify: { host: () => "" } },
      SuggestedVideos: "videos/suggested",
      UserProfile: "user/:userId",
      Search: "explore",
      Notifications: "notifications",
      GroupInvitations: { path: "chats/invitations/:token?", alias: ["group-invitations"], parse: { token: decodeURIComponent } },
      ChannelInvitations: { path: "channels/invitations/:token?", parse: { token: decodeURIComponent } },
      Chat: { path: "chats/:conversationId", alias: ["chat/:conversationId"], parse: { conversationId: decodeURIComponent, name: () => "Conversation" } },
      FollowRequests: "me/follow-requests",
      Orders: "orders",
      OrderDetail: "orders/:orderId",
      DisputeDetail: "disputes/:disputeId",
      SupportTicketDetail: "help/tickets/:ticketId",
      SellerDashboard: "seller/dashboard",
      CreatorDashboard: "creator/dashboard",
      CreatorAffiliates: "creator/affiliates",
      Story: "stories/:userId",
      SettingsWidgets: "settings/widgets",
      ManageProfiles: "settings/profiles",
      CreateBusinessProfile: "settings/profiles/business/new",
      CreateBrand: "settings/profiles/brand/new",
      SellerApplication: "seller/apply",
      Cart: "cart",
      Saved: "saved",
      Settings: "settings",
      AccountStatus: "settings/account-status",
      IdentityVerification: "settings/verification",
      SubscriptionOffer: "offer/:token",
      CreatePost: { path: "create/:mode?" },
      ProductForm: "seller/products/new",
      CreatorProgram: "creator",
      CreatorApplication: "creator/apply",
      UserProfileByUsername: { path: ":username", parse: { username: stripAtSign } },
      NotFound: "*",
    },
  },
};
