const guestBrowsablePagePatterns: readonly RegExp[] = [
  /^\/$/,
  /^\/(explore|mart|clips|live)$/,
  /^\/(product|category|collections|store|brand|user|post|watch|live)\/[A-Za-z0-9_.~%-]+$/,
];

const publicApiReadPatterns: readonly RegExp[] = [
  /^\/api\/v1\/feeds\/(popular|for-you|suggested-clips)$/,
  /^\/api\/v1\/(clips|videos|trending|categories|topics|search|mart\/home|products|products\/featured|lives\/suggested|users\/suggested|brands|gifts)$/,
  /^\/api\/v1\/creators\/(?!me$)[A-Za-z0-9_.~%-]+\/subscription-plans$/,
  /^\/api\/v1\/search\/[a-z-]+$/,
  /^\/api\/v1\/(videos|products|stores|brands|lives|posts|comments)\/[A-Za-z0-9_.~%-]+$/,
  /^\/api\/v1\/products\/[A-Za-z0-9_.~%-]+\/reviews$/,
  /^\/api\/v1\/stores\/[A-Za-z0-9_.~%-]+\/products$/,
  /^\/api\/v1\/posts\/[A-Za-z0-9_.~%-]+\/comments$/,
  /^\/api\/v1\/comments\/[A-Za-z0-9_.~%-]+\/replies$/,
  /^\/api\/v1\/lives\/[A-Za-z0-9_.~%-]+\/comments$/,
  /^\/api\/v1\/users\/(?!me$)[A-Za-z0-9_.~%-]+$/,
  /^\/api\/v1\/users\/(?!me\/)[A-Za-z0-9_.~%-]+\/posts$/,
];

export function isGuestBrowsablePage(pathname: string): boolean {
  return guestBrowsablePagePatterns.some((pattern) => pattern.test(pathname));
}

export function isPublicApiRead(method: string, apiPath: string): boolean {
  if (method === "POST" && apiPath === "/api/v1/mentions/resolve") return true;
  return method === "GET" && publicApiReadPatterns.some((pattern) => pattern.test(apiPath));
}
