export const canOfferPostNotificationMute = (isSignedIn: boolean, post: { readonly sponsored?: unknown }) => isSignedIn && !post.sponsored;

export const postNotificationMuteLabel = (muted: boolean) => (muted ? "Turn on notifications for this post" : "Turn off notifications for this post");
