import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { doesApiCallRequireStepUp, findAdminApiRoute, isReasonMissing, listAdminApiRoutes } from "@/config/apiAccess.config";
import { findRequirementForPagePath, navigationGroups } from "@/config/navigation.config";
import { adminRoleTemplates } from "@/constants/adminRoleTemplates.constant";
import { doesAdminMeetPageRequirement } from "@/utils/adminAccess.util";

const sourceRoot = join(process.cwd(), "src");

function listFiles(directory: string, accept: (path: string) => boolean): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return listFiles(path, accept);
    return accept(path) ? [path] : [];
  });
}

const pathHelperTemplates: Record<string, string> = {
  userPath: "/admin/users/${id}",
  documentPath: "/admin/legal/documents/${id}",
  versionPath: "/admin/legal/versions/${id}",
  verificationPath: "/admin/verifications/${id}",
  blackPath: "/admin/black-applications/${id}/",
};

interface ExtractedCall {
  readonly file: string;
  readonly method: string;
  readonly pathPatterns: readonly RegExp[];
  readonly source: string;
}

function templateToPattern(template: string): RegExp {
  const escaped = template.replace(/\$\{[^}]+\}/g, "\u0000").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\u0000/g, "[^/]+")}$`);
}

function expandHelperCall(argumentText: string): string | null {
  const helper = /^(\w+)\(([^,)]+)(?:,\s*(?:"([^"]*)"|`([^`]*)`|(\w+)))?\)/.exec(argumentText);
  if (!helper || !pathHelperTemplates[helper[1]!]) return null;
  return pathHelperTemplates[helper[1]!]! + (helper[3] ?? helper[4] ?? (helper[5] ? "${x}" : ""));
}

function extractServiceCalls(): ExtractedCall[] {
  const calls: ExtractedCall[] = [];
  const files = listFiles(join(sourceRoot, "services"), (path) => path.endsWith(".ts")).concat(listFiles(join(sourceRoot, "components"), (path) => path.endsWith(".tsx")));
  for (const file of files.filter((path) => !path.endsWith("adminApiClient.service.ts"))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/sendAdminApiRequest(?:<[^>]*>)?\(\s*([^\n]+)/g)) {
      const argumentText = match[1]!;
      const method = /method: "([A-Z]+)"/.exec(argumentText)?.[1] ?? "GET";
      const templates: string[] = [];
      const literal = /^(?:"([^"]+)"|`([^`]+)`)/.exec(argumentText);
      if (argumentText.includes("buildRecordPath(")) {
        const suffix = /buildRecordPath\([^)]*\)[}]?([^`,]*)/.exec(argumentText)?.[1] ?? "";
        templates.push("/admin/config/${id}" + suffix, "/admin/automation/rules/${id}" + suffix);
      } else if (argumentText.startsWith("endpoint.basePath")) templates.push("/admin/config", "/admin/automation/rules");
      else if (literal) templates.push(literal[1] ?? literal[2]!);
      else {
        const expanded = expandHelperCall(argumentText);
        if (expanded) templates.push(expanded);
      }
      assert.ok(templates.length > 0, `Could not read the API path in ${relative(sourceRoot, file)}: ${argumentText.slice(0, 80)}`);
      calls.push({ file: relative(sourceRoot, file), method, pathPatterns: templates.map(templateToPattern), source: templates.join(" or ") });
    }
  }
  return calls;
}

function sampleConcretePaths(path: string): string[] {
  let samples = [""];
  for (const segment of path.split("/").slice(1)) {
    const choices = /^\{(.+)\}$/.exec(segment)?.[1]?.split("|") ?? [segment.startsWith(":") ? "sample" : segment];
    samples = samples.flatMap((prefix) => choices.map((choice) => `${prefix}/${choice}`));
  }
  return samples;
}

const concreteRoutes = listAdminApiRoutes().flatMap((route) => sampleConcretePaths(route.path).map((path) => ({ method: route.method, path })));

describe("admin BFF route table", () => {
  it("every API call the console makes maps to a route with a specific rule", () => {
    const calls = extractServiceCalls();
    assert.ok(calls.length > 150, `expected the full call inventory, found ${calls.length}`);
    const unmapped = calls.filter((call) => !call.pathPatterns.some((pattern) => concreteRoutes.some((route) => route.method === call.method && pattern.test(route.path))));
    assert.deepEqual(unmapped.map((call) => `${call.method} ${call.source} (${call.file})`), []);
  });

  it("denies unknown routes and wrong methods by default", () => {
    assert.equal(findAdminApiRoute("GET", "/admin/flags"), null);
    assert.equal(findAdminApiRoute("GET", "/admin/notification-templates"), null);
    assert.equal(findAdminApiRoute("GET", "/admin/waitlist"), null);
    assert.equal(findAdminApiRoute("DELETE", "/admin/users/u1"), null);
    assert.equal(findAdminApiRoute("POST", "/admin/users/u1/personal-data"), null);
    assert.equal(findAdminApiRoute("GET", "/admin/chats/c1/messages"), null);
  });

  it("wires event operations through the same events:read permission in the page, BFF, and Operations Analyst profile", () => {
    const pageRequirement = findRequirementForPagePath("/operations/events");
    assert.equal(doesAdminMeetPageRequirement({ role: "ADMIN", permissions: ["events:read"] }, pageRequirement!), true);
    assert.equal(doesAdminMeetPageRequirement({ role: "ADMIN", permissions: ["metrics:read"] }, pageRequirement!), false);

    const route = findAdminApiRoute("GET", "/admin/event-operations/queues");
    assert.deepEqual(route?.requirement, { kind: "anyOf", permissions: ["events:read"] });

    const operationsAnalyst = adminRoleTemplates.find((template) => template.name === "Operations Analyst");
    assert.ok(operationsAnalyst?.permissions.includes("events:read"));
    assert.ok(navigationGroups.flatMap((group) => group.items).some((item) => item.href === "/operations/events" && item.requirement === "events:read"));
  });

  it("only the caller's own account endpoints are open to every signed-in admin", () => {
    const open = listAdminApiRoutes().filter((route) => route.requirement.kind === "ownAccount").map((route) => route.path);
    assert.ok(open.length > 0);
    for (const path of open) assert.match(path, /^\/admin\/(account|consents|users\/me\/)/);
  });

  it("requires step-up for every sensitive action the owner listed", () => {
    const sensitive: [string, string][] = [
      ["POST", "/admin/withdrawals/w1/review"],
      ["POST", "/admin/refunds"],
      ["POST", "/admin/disputes/d1/resolve"],
      ["POST", "/admin/coins/transactions/t1/reverse"],
      ["POST", "/admin/payments/webhooks/dead-letters/h1/replay"],
      ["POST", "/admin/users/u1/suspend"],
      ["POST", "/admin/users/u1/ban"],
      ["POST", "/admin/users/u1/delete"],
      ["POST", "/admin/users/u1/username/reassign"],
      ["POST", "/admin/checkmark-grants/g1/revoke"],
      ["GET", "/admin/users/u1/personal-data"],
      ["PUT", "/admin/admins/a1/permissions"],
      ["POST", "/admin/admins/a1/disable"],
      ["POST", "/admin/roles"],
      ["POST", "/admin/legal/versions/v1/publish"],
      ["POST", "/admin/legal/notices"],
      ["PUT", "/admin/config/plans"],
      ["POST", "/admin/verification-cases/c1/replay-callback"],
    ];
    for (const [method, path] of sensitive) assert.equal(doesApiCallRequireStepUp(method, path), true, `${method} ${path}`);
    assert.equal(doesApiCallRequireStepUp("POST", "/admin/chat-reports/r1/actions", { action: "BAN_USER", reason: "abuse" }), true);
    assert.equal(doesApiCallRequireStepUp("POST", "/admin/chat-reports/r1/actions", { action: "DISMISS", reason: "fine" }), false);
    assert.equal(doesApiCallRequireStepUp("GET", "/admin/users/u1"), false);
  });

  it("limits confusable username previews to staff who can resolve ownership", () => {
    const route = findAdminApiRoute("GET", "/admin/usernames/confusables")!;
    assert.deepEqual(route.requirement, { kind: "anyOf", permissions: ["usernames:reassign"] });
  });

  it("requires a reason on destructive mutations and rejects blank ones", () => {
    const destructive = listAdminApiRoutes().filter((route) => route.method !== "GET" && route.stepUp && !/^\/admin\/(account|usernames\/reserved|trending|payouts\/run)/.test(route.path));
    for (const route of destructive) assert.equal(route.reasonRequired, true, `${route.method} ${route.path} must require a reason`);
    const ban = findAdminApiRoute("POST", "/admin/users/u1/ban")!;
    assert.equal(isReasonMissing(ban, { reason: "   " }), true);
    assert.equal(isReasonMissing(ban, { reason: "abc" }), true);
    assert.equal(isReasonMissing(ban, null), true);
    assert.equal(isReasonMissing(ban, { reason: "Repeated scam listings" }), false);
  });
});

describe("price tables", () => {
  it("read-only config staff can view but not save", () => {
    const viewer = { role: "ADMIN" as const, permissions: ["config:read" as const] };
    const canCall = (method: string, path: string) => {
      const route = findAdminApiRoute(method, path)!;
      return route.requirement.kind === "anyOf" && doesAdminMeetPageRequirement(viewer, route.requirement.permissions);
    };
    assert.equal(canCall("GET", "/admin/coins/price-table"), true);
    assert.equal(canCall("GET", "/admin/subscriptions/price-table"), true);
    assert.equal(canCall("PUT", "/admin/coins/price-table/pack_1"), false);
    assert.equal(canCall("PUT", "/admin/subscriptions/price-table/blue/NG"), false);
    assert.equal(doesApiCallRequireStepUp("PUT", "/admin/coins/price-table/pack_1"), true);
    assert.equal(doesApiCallRequireStepUp("PUT", "/admin/subscriptions/price-table/blue/NG"), true);
  });
});

describe("admin page access", () => {
  const consoleRoot = join(sourceRoot, "app", "(console)");
  const pagePaths = listFiles(consoleRoot, (path) => path.endsWith("page.tsx")).map((file) => `/${relative(consoleRoot, file).replace(/\/?page\.tsx$/, "").replace(/\[[^\]]+\]/g, "sample")}`);
  const accountsWorkspaceSource = readFileSync(join(sourceRoot, "components", "people", "accounts", "accountsWorkspace.tsx"), "utf8");
  const logisticsWorkspaceSource = readFileSync(join(sourceRoot, "components", "money", "logisticsWorkspace.tsx"), "utf8");

  it("every console page maps to a permission (deny by default)", () => {
    assert.ok(pagePaths.length > 40);
    assert.deepEqual(pagePaths.filter((path) => findRequirementForPagePath(path) === null), []);
    assert.equal(findRequirementForPagePath("/config/flags"), null);
    assert.equal(findRequirementForPagePath("/not-a-page"), null);
  });

  it("hides navigation a support agent can't use", () => {
    const agent = { role: "SUPPORT" as const, permissions: ["support:tickets" as const] };
    const visible = navigationGroups.flatMap((group) => group.items).filter((item) => doesAdminMeetPageRequirement(agent, item.requirement)).map((item) => item.href);
    assert.deepEqual(visible, ["/commerce/orders", "/support"]);
    assert.equal(doesAdminMeetPageRequirement(agent, findRequirementForPagePath("/commerce/payouts")!), false);
    assert.equal(doesAdminMeetPageRequirement(agent, findRequirementForPagePath("/users/sample")!), false);
  });

  it("lands revoke-only Accounts admins on the checkmark list they can access", () => {
    const revokeOnly = { role: "ADMIN" as const, permissions: ["verification:revoke" as const] };
    const accountsRequirement = findRequirementForPagePath("/accounts");
    assert.ok(accountsRequirement);
    assert.equal(doesAdminMeetPageRequirement(revokeOnly, accountsRequirement), true);

    const canReadRoute = (path: string) => {
      const route = findAdminApiRoute("GET", path)!;
      assert.equal(route.requirement.kind, "anyOf");
      return route.requirement.kind === "anyOf" && doesAdminMeetPageRequirement(revokeOnly, route.requirement.permissions);
    };
    assert.equal(canReadRoute("/admin/accounts/created"), false);
    assert.equal(canReadRoute("/admin/checkmark-grants"), true);

    assert.match(accountsWorkspaceSource, /getInitialAccountsTab\(can\("verification:grant"\)\)/);
    assert.match(accountsWorkspaceSource, /return canGrant \? "CREATED" : "CHECKMARKS";/);
  });

  it("provides the requested assignable, scoped department profiles", () => {
    const byName = new Map(adminRoleTemplates.map((template) => [template.name, template]));
    for (const name of ["Trust & Verification", "Finance Admin", "Moderation Admin", "Support Agent", "Subscription Manager", "Operations Analyst", "Auditor"]) {
      assert.ok(byName.has(name), `missing ${name} role template`);
    }

    const profile = (name: string) => ({ role: "ADMIN" as const, permissions: byName.get(name)!.permissions });
    const visiblePages = (name: string) => navigationGroups.flatMap((group) => group.items).filter((item) => doesAdminMeetPageRequirement(profile(name), item.requirement)).map((item) => item.href);

    const trustVerificationPages = visiblePages("Trust & Verification");
    for (const page of ["/verification", "/verification/business-documents", "/verification/black", "/applications/sellers", "/applications/creators", "/brands"]) assert.ok(trustVerificationPages.includes(page), `Trust & Verification cannot access ${page}`);
    assert.ok(!trustVerificationPages.includes("/moderation/reports"));

    const moderationPages = visiblePages("Moderation Admin");
    for (const page of ["/moderation/reports", "/moderation/appeals", "/moderation/chat-reports", "/moderation/suspensions", "/moderation/security"]) assert.ok(moderationPages.includes(page), `Moderation Admin cannot access ${page}`);
    assert.ok(!moderationPages.includes("/verification/black"));

    const subscriptionPages = visiblePages("Subscription Manager");
    for (const page of ["/config/plans", "/config/pricing", "/config/offers"]) assert.ok(subscriptionPages.includes(page), `Subscription Manager cannot access ${page}`);
    for (const page of ["/config/revenue", "/config/rules", "/config/ranking", "/config/automation"]) assert.ok(!subscriptionPages.includes(page), `Subscription Manager unexpectedly sees ${page}`);

    assert.ok(visiblePages("Operations Analyst").includes("/overview"));
    assert.ok(visiblePages("Operations Analyst").includes("/commerce/logistics"));
    assert.ok(!visiblePages("Operations Analyst").includes("/audit"));
    assert.ok(!visiblePages("Support Agent").includes("/commerce/logistics"));
    assert.deepEqual(visiblePages("Auditor"), ["/audit"]);

    const financePages = visiblePages("Finance Admin");
    for (const page of ["/finance", "/finance/issues", "/finance/lookup", "/finance/escrow", "/finance/aspects", "/finance/reports", "/commerce/orders", "/commerce/payouts", "/commerce/ledger"]) {
      assert.ok(financePages.includes(page), `Finance Admin cannot access ${page}`);
    }
    assert.ok(!financePages.includes("/users"));
    assert.ok(!financePages.includes("/moderation/reports"));
    assert.equal(doesApiCallRequireStepUp("POST", "/admin/finance/reports/export"), true);
    assert.deepEqual(findAdminApiRoute("GET", "/admin/finance/overview")?.requirement, { kind: "anyOf", permissions: ["finance:reports"] });
  });

  it("does not route logistics-only staff into the protected order investigation page", () => {
    const operationsProfile = { role: "ADMIN" as const, permissions: adminRoleTemplates.find((template) => template.name === "Operations Analyst")!.permissions };
    const supportProfile = { role: "ADMIN" as const, permissions: adminRoleTemplates.find((template) => template.name === "Support Agent")!.permissions };
    const orderDetailRequirement = findRequirementForPagePath("/commerce/orders/sample");
    assert.ok(orderDetailRequirement);
    assert.equal(doesAdminMeetPageRequirement(operationsProfile, orderDetailRequirement), false);
    assert.equal(doesAdminMeetPageRequirement(supportProfile, orderDetailRequirement), true);
    assert.match(logisticsWorkspaceSource, /onRowOpen=\{canAny\("orders:read", "disputes:resolve", "refunds:issue", "support:tickets"\) \?/);
  });

  it("gives a superadmin every permission-backed page and API capability", () => {
    const superadmin = { role: "SUPERADMIN" as const, permissions: [] as const };
    const pages = navigationGroups.flatMap((group) => group.items);
    for (const page of pages) assert.equal(doesAdminMeetPageRequirement(superadmin, page.requirement), true, page.href);
    for (const route of listAdminApiRoutes()) {
      if (route.requirement.kind === "anyOf") assert.equal(doesAdminMeetPageRequirement(superadmin, route.requirement.permissions), true, `${route.method} ${route.path}`);
      if (route.requirement.kind === "superadmin") assert.equal(doesAdminMeetPageRequirement(superadmin, "SUPERADMIN"), true, `${route.method} ${route.path}`);
    }
    assert.equal(doesAdminMeetPageRequirement({ role: "ADMIN", permissions: [] }, "SUPERADMIN"), false);
  });

  it("does not ship dropped features", () => {
    const hrefs = navigationGroups.flatMap((group) => group.items).map((item) => item.href);
    for (const dropped of ["/waitlist", "/loyalty", "/referrals", "/cashback", "/config/flags", "/config/templates"]) assert.equal(hrefs.includes(dropped), false, dropped);
  });
});
