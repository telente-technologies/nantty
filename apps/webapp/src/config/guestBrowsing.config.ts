import { isUsernameProfilePath } from "./reservedRoutes.config";

const guestBrowsablePagePatterns: readonly RegExp[] = [
  /^\/$/,
  /^\/(explore|mart|clips|live)$/,
  /^\/(product|p|category|collections|store|brand|user|u|watch|live)\/[A-Za-z0-9_.~%-]+$/,
  /^\/post\/(?!new$)[A-Za-z0-9_.~%-]+$/,
  /^\/post\/[A-Za-z0-9_.~%-]+\/quotes$/,
  /^\/product\/[A-Za-z0-9_.~%-]+\/reviews$/,
  /^\/post\/[A-Za-z0-9_.~%-]+\/comment\/[A-Za-z0-9_.~%-]+$/,
  /^\/help(?:\/(?!tickets(?:\/|$))[a-z0-9-]+(?:\/[a-z0-9-]+)?)?$/,
];

const publicApiReadPatterns: readonly RegExp[] = [
  /^\/api\/v1\/feeds\/(popular|for-you|suggested-clips)$/,
  /^\/api\/v1\/explore\/(categories|trends|headlines|who-to-follow|posts-for-you)$/,
  /^\/api\/v1\/(clips|videos|categories|topics|search|mart\/home|mart\/highlights|products|products\/featured|brands)$/,
  /^\/api\/v1\/creators\/(?!me$)[A-Za-z0-9_.~%-]+\/subscription-plans$/,
  /^\/api\/v1\/search\/[a-z-]+$/,
  /^\/api\/v1\/help\/(categories|topics)(\/[a-z0-9-]+)?$/,
  /^\/api\/v1\/(videos|products|stores|brands|posts|comments)\/[A-Za-z0-9_.~%-]+$/,
  /^\/api\/v1\/lives\/(?!suggested$)[A-Za-z0-9_.~%-]+$/,
  /^\/api\/v1\/products\/[A-Za-z0-9_.~%-]+\/reviews$/,
  /^\/api\/v1\/stores\/[A-Za-z0-9_.~%-]+\/products$/,
  /^\/api\/v1\/posts\/[A-Za-z0-9_.~%-]+\/comments$/,
  /^\/api\/v1\/posts\/[A-Za-z0-9_.~%-]+\/(quotes|thread)$/,
  /^\/api\/v1\/comments\/[A-Za-z0-9_.~%-]+\/thread$/,
  /^\/api\/v1\/comments\/[A-Za-z0-9_.~%-]+\/replies$/,
  /^\/api\/v1\/users\/by-username\/[A-Za-z0-9_.~%-]+$/,
  /^\/api\/v1\/users\/(?!me\/)[A-Za-z0-9_.~%-]+\/posts$/,
  /^\/api\/v1\/legal\/policy-versions\/current$/,
];

export function isGuestBrowsablePage(pathname: string): boolean {
  return isUsernameProfilePath(pathname) || guestBrowsablePagePatterns.some((pattern) => pattern.test(pathname));
}

export function isPublicApiRead(method: string, apiPath: string): boolean {
  if (method === "POST" && apiPath === "/api/v1/mentions/resolve") return true;
  return method === "GET" && publicApiReadPatterns.some((pattern) => pattern.test(apiPath));
}
