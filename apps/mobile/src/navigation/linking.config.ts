import type { LinkingOptions } from "@react-navigation/native";

import { deepLinkPrefixes, readProductIdFromSlug } from "@/config/webAppLinks.config";

import type { RootStackParamList } from "./navigation.types";

const stripAtSign = (value: string) => decodeURIComponent(value).replace(/^@/, "");

export const deepLinking: LinkingOptions<RootStackParamList> = {
  prefixes: [...deepLinkPrefixes],
  config: {
    screens: {
      Tabs: { screens: { Home: "", Clips: "clips", Chats: "chats", Me: "me" } },
      ProductDetail: { path: "p/:productId", alias: ["product/:productId", "products/:productId"], parse: { productId: readProductIdFromSlug } },
      Store: { path: "store/:storeId", alias: ["stores/:storeId"] },
      PostDetail: { path: "post/:postId", alias: ["posts/:postId"] },
      Live: { path: "live/:liveId", alias: ["lives/:liveId"], parse: { liveId: decodeURIComponent }, stringify: { host: () => "" } },
      UserProfile: "user/:userId",
      Search: "explore",
      Notifications: "notifications",
      Orders: "orders",
      Cart: "cart",
      Saved: "saved",
      Settings: "settings",
      CreatePost: { path: "create/:mode?" },
      ProductForm: "seller/products/new",
      CreatorProgram: "creator",
      UserProfileByUsername: { path: ":username", parse: { username: stripAtSign } },
    },
  },
};
