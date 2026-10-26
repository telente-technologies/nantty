const webappOrigin = (process.env.NEXT_PUBLIC_WEBAPP_URL ?? "https://web.nantty.com").replace(/\/+$/, "");

export const webappLinks = {
  withdraw: `${webappOrigin}/wallet/payouts`,
  accountStatus: `${webappOrigin}/settings/account-status`,
  creatorProgram: `${webappOrigin}/creator/program`,
  creatorApply: `${webappOrigin}/creator/apply`,
  help: `${webappOrigin}/help`,
  notifications: `${webappOrigin}/notifications`,
  manageProfiles: `${webappOrigin}/settings/profiles`,
  newPost: `${webappOrigin}/post/new`,
  newClip: `${webappOrigin}/create/clip`,
  profile: (username: string) => `${webappOrigin}/u/${encodeURIComponent(username)}`,
  affiliateProductLink: (path: string) => `${webappOrigin}${path.startsWith("/") ? path : `/${path}`}`,
  post: (postId: string) => `${webappOrigin}/post/${encodeURIComponent(postId)}`,
} as const;
