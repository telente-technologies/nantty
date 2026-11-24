import { describe, expect, it } from "vitest";
import { createHttpServer, createNodeHttpAdapter, createPlatform, createRequestContext, createResponseContext, createRouter } from "@nantty/fastify-platform";
import { createSocialRouter } from "../../src/fastifyRouter.js";

describe("Fastify platform compatibility", () => {
  it("preserves sanitized Fastify client errors without leaking error details", async () => {
    const app = await createPlatform({ name: "error-test", host: "127.0.0.1", port: 0, logger: false, rateLimit: false });
    app.post("/echo", async () => ({ ok: true }));
    app.get("/validated", { schema: { querystring: { type: "object", required: ["privateField"], properties: { privateField: { type: "integer" } } } } }, async () => "ok");
    app.get("/rejected", async () => { throw Object.assign(new Error("private reason"), { statusCode: 422, code: "secret token" }); });
    app.get("/broken", async () => { throw new Error("private credentials"); });
    try {
      const unsupported = await app.inject({ method: "POST", url: "/echo", headers: { "content-type": "application/octet-stream" }, payload: Buffer.from([0, 0xff]) });
      expect(unsupported.statusCode).toBe(415);
      expect(unsupported.json()).toEqual({ message: "Unsupported Media Type", code: "FST_ERR_CTP_INVALID_MEDIA_TYPE" });
      const invalid = await app.inject("/validated?privateField=private-value");
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json()).toEqual({ message: "Bad Request", code: "FST_ERR_VALIDATION" });
      expect(invalid.body).not.toContain("private");
      expect((await app.inject("/rejected")).json()).toEqual({ message: "Unprocessable Entity", code: "HTTP_422" });
      const broken = await app.inject("/broken");
      expect(broken.statusCode).toBe(500);
      expect(broken.json()).toEqual({ message: "Internal Server Error", code: "INTERNAL_ERROR" });
    } finally { await app.close(); }
  });

  it("uses Fastify route precedence, decoding, repeated queries, HEAD and method negotiation", async () => {
    const router = createRouter();
    router.get("/items/:id", ({ params, query }) => createResponseContext().json({ params, query }));
    router.get("/items/current", () => createResponseContext().text("static"));
    const dispatch = (method: string, url: string) => router.dispatch(createRequestContext({ method, url }));
    expect((await dispatch("GET", "/items/current")).response.body).toBe("static");
    expect((await dispatch("GET", "/items/a%20b?tag=one&tag=two")).response.body).toEqual({ params: { id: "a b" }, query: { tag: ["one", "two"] } });
    expect((await dispatch("HEAD", "/items/current")).route?.path).toBe("/items/current");
    expect((await dispatch("POST", "/items/one")).response.status).toBe(405);
    expect((await dispatch("OPTIONS", "/items/one")).response.headers["allow"]).toContain("GET");
    expect((await dispatch("GET", "/items/%ZZ")).response.status).toBe(400);
    expect((await dispatch("GET", "/absent")).response.status).toBe(404);
  });

  it("keeps concurrent dispatch envelopes, failures and cancellation isolated", async () => {
    const router = createRouter({ onError: (error) => error instanceof RangeError ? createResponseContext({ status: 422 }) : undefined });
    router.patch("/items/:id", async ({ request, params, signal }) => {
      await Promise.resolve();
      expect(signal).toBe(request.signal);
      return createResponseContext().json({ id: params["id"], body: request.body });
    });
    router.get("/handled", () => { throw new RangeError(); });
    router.get("/unhandled", () => { throw new Error("domain failure"); });
    const results = await Promise.all(["a", "b"].map((id) => router.dispatch(createRequestContext({ method: "PATCH", url: `/items/${id}`, body: id, signal: new AbortController().signal }))));
    expect(results.map((result) => result.response.body)).toEqual([{ id: "a", body: "a" }, { id: "b", body: "b" }]);
    expect((await router.dispatch(createRequestContext({ method: "GET", url: "/handled" }))).response.status).toBe(422);
    await expect(router.dispatch(createRequestContext({ method: "GET", url: "/unhandled" }))).rejects.toThrow("domain failure");
  });

  it("serves the compatibility handler through Fastify with raw bytes and body limits", async () => {
    const server = createHttpServer({ adapter: createNodeHttpAdapter({ host: "127.0.0.1", port: 0, maxBodySize: 16, trustProxy: true }), handler: async (request) => createResponseContext().json({ body: Buffer.from(request.body as Uint8Array).toString(), ip: request.remoteAddress, protocol: request.protocol }) });
    await server.start();
    try {
      const url = `http://127.0.0.1:${server.address!.port}/echo`;
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", "x-forwarded-proto": "https" }, body: "{ invalid json" });
      expect(await response.json()).toEqual({ body: "{ invalid json", ip: "203.0.113.7", protocol: "https" });
      expect((await fetch(url, { method: "POST", body: "a".repeat(17) })).status).toBe(413);
    } finally { await server.stop(); }
    expect(server.address).toBeUndefined();
  });

  it("runs Social middleware and routes on actual Fastify requests", async () => {
    const app = await createPlatform({ name: "social-test", host: "127.0.0.1", port: 0, logger: false, rateLimit: false });
    const router = createSocialRouter(app);
    router.get("/items/:id", ({ params, query }) => createResponseContext().json({ params, query }));
    router.post("/items/:id", ({ request }) => createResponseContext().text(String(request.body)));
    let calls = 0;
    router.setFastifyHandler(async (request) => { calls++; return (await router.dispatch(request)).response; });
    try {
      const result = await app.inject("/items/a%20b?tag=one&tag=two");
      expect(result.json()).toEqual({ params: { id: "a b" }, query: { tag: ["one", "two"] } });
      expect((await app.inject({ method: "HEAD", url: "/items/one" })).body).toBe("");
      expect(calls).toBe(2);
      expect((await app.inject({ method: "DELETE", url: "/items/one" })).statusCode).toBe(405);
      expect((await app.inject({ method: "POST", url: "/items/one", headers: { "content-type": "application/json" }, payload: "{bad" })).body).toBe("{bad");
    } finally { await app.close(); }
  });
});
