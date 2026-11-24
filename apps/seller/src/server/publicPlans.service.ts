import { headers } from "next/headers";

import { callSellerBackend, readJsonFromBackendResult } from "@/server/sellerApiTransport.service";
import type { CursorPage } from "@/types/pagination.type";
import type { SubscriptionPlan } from "@/types/subscription.type";

export interface PublicPricingContext {
  readonly plans: SubscriptionPlan[];
  readonly locale: string;
}

function readPreferredLocaleFromAcceptLanguage(acceptLanguage: string | null): string {
  const firstTag = acceptLanguage?.split(",")[0]?.split(";")[0]?.trim();
  if (!firstTag || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(firstTag)) return "en-NG";
  try {
    return Intl.getCanonicalLocales(firstTag)[0] ?? "en-NG";
  } catch {
    return "en-NG";
  }
}

export async function loadPublicSubscriptionPlansForVisitor(): Promise<PublicPricingContext> {
  const requestHeaders = await headers();
  const forwardedHeaders: Record<string, string> = {};
  const acceptLanguage = requestHeaders.get("accept-language");
  const forwardedParts = requestHeaders.get("x-forwarded-for")?.split(",").map((entry) => entry.trim()).filter(Boolean);
  const clientAddress = forwardedParts?.at(-1) || requestHeaders.get("x-real-ip")?.trim();
  if (acceptLanguage) forwardedHeaders["Accept-Language"] = acceptLanguage.slice(0, 200);
  if (clientAddress) forwardedHeaders["X-Forwarded-For"] = clientAddress;
  const result = await callSellerBackend({ method: "GET", path: "/seller/subscription/plans", forwardedHeaders });
  const plans = result.status === 200 ? readJsonFromBackendResult<CursorPage<SubscriptionPlan>>(result)?.data ?? [] : [];
  return { plans, locale: readPreferredLocaleFromAcceptLanguage(acceptLanguage) };
}
