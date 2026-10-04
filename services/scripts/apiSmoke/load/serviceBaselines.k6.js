import { check } from "k6";
import crypto from "k6/crypto";
import http from "k6/http";
import { Trend } from "k6/metrics";
import ws from "k6/ws";

const fixtures = JSON.parse(open(__ENV.LOAD_FIXTURES_PATH));
const gateway = __ENV.GATEWAY_URL || "http://localhost:8080";
const scenarioName = __ENV.SCENARIO;
const virtualUsers = Number(__ENV.VUS || 10);
const duration = __ENV.DURATION || "20s";
const fanoutLatency = new Trend("realtime_fanout_ms", true);

export const options = {
  scenarios: { [scenarioName]: { executor: "constant-vus", vus: virtualUsers, duration } },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max", "count"],
  thresholds: Object.fromEntries(["cart_add", "cart_read", "checkout", "payment_initialize", "upload_plan", "live_comment"].map((name) => [`http_req_duration{name:${name}}`, ["max>=0"]])),
  discardResponseBodies: false,
};

function user() {
  return fixtures.users[(__VU - 1) % fixtures.users.length];
}

function headersFor(actor, extra) {
  return Object.assign({ "content-type": "application/json", authorization: `Bearer ${actor.accessToken}`, "x-device-id": `k6-${__VU}`, "idempotency-key": `k6-${__VU}-${__ITER}-${Date.now()}` }, extra || {});
}

function signIntelligence(path, body) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = `k6${__VU}x${__ITER}x${Math.random().toString(36).slice(2, 14)}`;
  const canonical = ["v1", "POST", path, timestamp, nonce, crypto.sha256(body, "hex")].join("\n");
  return { "content-type": "application/json", "x-zudo-timestamp": timestamp, "x-zudo-nonce": nonce, "x-zudo-signature": `v1=${crypto.hmac("sha256", fixtures.intelligenceSecret, canonical, "hex")}` };
}

function feedCandidates(count) {
  const now = Date.now();
  const candidates = [];
  for (let index = 0; index < count; index += 1) {
    candidates.push({ itemId: `p_${index}`, authorId: `u_${index % 7}`, contentKind: "personal", mediaKind: "image", mediaCount: 1, createdAt: new Date(now - index * 600000).toISOString(), topics: ["fashion"], hashtags: [], likeCount: index * 3, commentCount: index, shareCount: 1, viewCount: 100 + index, authorFollowerCount: 500, authorIsVerified: false, country: "NG", isSensitive: false, isReported: false, productPrice: null, friendEngagements: [] });
  }
  return candidates;
}

function addToCart(actor) {
  return http.post(`${gateway}/api/v1/cart/items`, JSON.stringify({ productId: fixtures.store.productId, variantId: fixtures.store.variantId, quantity: 1 }), { headers: headersFor(actor), tags: { name: "cart_add" } });
}

function checkout(actor) {
  addToCart(actor);
  return http.post(`${gateway}/api/v1/orders/checkout`, JSON.stringify({ addressId: actor.addressId }), { headers: headersFor(actor), tags: { name: "checkout" } });
}

const scenarios = {
  gateway_currencies: () => check(http.get(`${gateway}/api/v1/currencies`, { tags: { name: "gateway_currencies" } }), { ok: (r) => r.status === 200 }),
  direct_currencies: () => check(http.get("http://localhost:8101/api/v1/currencies", { tags: { name: "direct_currencies" } }), { ok: (r) => r.status === 200 }),
  identity_login: () => check(http.post(`${gateway}/api/v1/auth/login`, JSON.stringify({ identifier: user().email, password: "Sm0ke-Test-Pass!2026" }), { headers: { "content-type": "application/json" }, tags: { name: "login" } }), { ok: (r) => r.status === 200 }),
  identity_me: () => check(http.get(`${gateway}/api/v1/users/me`, { headers: headersFor(user()), tags: { name: "me" } }), { ok: (r) => r.status === 200 }),
  social_feed: () => check(http.get(`${gateway}/api/v1/feeds/${__ITER % 2 === 0 ? "following" : "for-you"}`, { headers: headersFor(user()), tags: { name: "feed" } }), { ok: (r) => r.status === 200 }),
  social_post_create: () => check(http.post(`${gateway}/api/v1/posts`, JSON.stringify({ text: `k6 post ${__VU}-${__ITER}` }), { headers: headersFor(user()), tags: { name: "post_create" } }), { ok: (r) => r.status === 201 }),
  search_query: () => check(http.get(`${gateway}/api/v1/search?q=${["load", "shirt", "smoke", "store"][__ITER % 4]}`, { headers: headersFor(user()), tags: { name: "search" } }), { ok: (r) => r.status === 200 }),
  commerce_cart: () => {
    check(addToCart(user()), { added: (r) => r.status === 200 || r.status === 201 });
    check(http.get(`${gateway}/api/v1/cart`, { headers: headersFor(user()), tags: { name: "cart_read" } }), { ok: (r) => r.status === 200 });
  },
  commerce_checkout: () => check(checkout(user()), { ok: (r) => r.status === 200 || r.status === 201 }),
  money_initialize: () => {
    const created = checkout(user());
    const checkoutId = created.json("checkoutId") || created.json("id");
    check(http.post(`${gateway}/api/v1/payments/initialize`, JSON.stringify({ checkoutId }), { headers: headersFor(user()), tags: { name: "payment_initialize" } }), { ok: (r) => r.status === 201 });
  },
  money_webhook: () => {
    const body = JSON.stringify({ event: "charge.success", data: { id: __VU * 1000000 + __ITER, reference: `k6-unknown-${__VU}-${__ITER}`, status: "success", amount: 100000, currency: "NGN" } });
    const signature = crypto.hmac("sha512", fixtures.paystackSecret, body, "hex");
    check(http.post(`${gateway}/webhooks/paystack`, body, { headers: { "content-type": "application/json", "x-paystack-signature": signature }, tags: { name: "paystack_webhook" } }), { ok: (r) => r.status === 200 });
  },
  live_gift: () => check(http.post(`${gateway}/api/v1/lives/${fixtures.liveId}/gifts`, JSON.stringify({ giftId: fixtures.giftId, quantity: 1, receiverUserId: fixtures.host.accountId }), { headers: headersFor(user()), tags: { name: "gift_send" } }), { answered: (r) => r.status === 201 || r.status === 200 || r.status === 402 }),
  notifications_inbox: () => check(http.get(`${gateway}/api/v1/notifications`, { headers: headersFor(user()), tags: { name: "inbox" } }), { ok: (r) => r.status === 200 }),
  media_upload_plan: () => {
    const plan = http.post(`${gateway}/api/v1/media/uploads`, JSON.stringify({ fileName: "k6.png", mimeType: "image/png", sizeBytes: 200000, purpose: "post" }), { headers: headersFor(user()), tags: { name: "upload_plan" } });
    check(plan, { ok: (r) => r.status === 201 });
    if (plan.status === 201) http.del(`${gateway}/api/v1/media/uploads/${plan.json("uploadId")}`, null, { headers: headersFor(user()), tags: { name: "upload_cancel" } });
  },
  ads_decide: () => check(http.post(`${gateway}/api/v1/ads/decide`, JSON.stringify({ slot: { kind: "feedPost", contentId: `post-${__ITER}`, neighbourContentIds: [], slotsSinceLastAd: 5 }, sessionId: `k6-session-${__VU}`, viewer: { region: "NG-LA", topics: ["fashion"] } }), { headers: headersFor(user()), tags: { name: "ads_decide" } }), { ok: (r) => r.status === 200 || r.status === 204 }),
  intelligence_feed_rank: () => {
    const body = JSON.stringify({ requestId: `k6-${__VU}-${__ITER}`, feedMode: "for_you", viewer: { userId: `u_${__VU}`, country: "NG", chosenTopics: ["fashion"], followedAccountIds: ["u_1"] }, candidates: feedCandidates(100), limit: 30 });
    check(http.post("http://localhost:8090/v1/feed/rank", body, { headers: signIntelligence("/v1/feed/rank", body), tags: { name: "feed_rank" } }), { ok: (r) => r.status === 200 });
  },
  realtime_fanout: () => {
    const actor = user();
    const pending = {};
    ws.connect("ws://localhost:4000/ws", {}, (socket) => {
      socket.on("open", () => socket.send(JSON.stringify({ type: "auth", accessToken: actor.accessToken })));
      socket.on("message", (raw) => {
        const frame = JSON.parse(raw);
        if (frame.type === "auth.ok") socket.send(JSON.stringify({ type: "subscribe", topic: `live:${fixtures.liveId}` }));
        if (frame.type === "subscribed") {
          socket.setInterval(() => {
            const text = `k6 ${__VU} ${Date.now()}`;
            pending[text] = Date.now();
            http.post(`${gateway}/api/v1/lives/${fixtures.liveId}/comments`, JSON.stringify({ text }), { headers: headersFor(actor), tags: { name: "live_comment" } });
          }, 1000);
        }
        if (frame.type === "live.comment" && pending[frame.text] !== undefined) {
          fanoutLatency.add(Date.now() - pending[frame.text]);
          delete pending[frame.text];
        }
      });
      socket.setTimeout(() => socket.close(), 15000);
    });
  },
};

export default function () {
  scenarios[scenarioName]();
}

export function handleSummary(data) {
  return { [`${__ENV.REPORT_DIR}/k6-${scenarioName}.json`]: JSON.stringify(data) };
}
