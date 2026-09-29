import { findManagedBrandOrThrow, recordBrandAuditEntry, requireBrandRole } from "@/mocks/brandsMockStore.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockIdentifier, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { BrandMember, BrandMemberRole } from "@/types/brand.type";
import { fieldChecks, validateObjectAgainstChecks } from "@/utils/formValidation.util";

const assignableBrandRoles: BrandMemberRole[] = ["admin", "editor", "viewer"];
const maximumBrandMembers = 30;

export function registerBrandMembersMockRoutes(): void {
  registerMockRoute("GET", "/seller/brands/:brandId/members", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { brand } = findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId);
    return respondWithJson(200, { data: brand.members, nextCursor: null });
  });

  registerMockRoute("POST", "/seller/brands/:brandId/members", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { brand, member } = findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId);
    requireBrandRole(member, ["owner", "admin"], "add team members");
    const body = readJsonObjectBody(request);
    const issues = validateObjectAgainstChecks(body, {
      name: fieldChecks.text({ label: "Name", min: 2, max: 80 }),
      email: fieldChecks.email(),
      role: fieldChecks.oneOf("Role", assignableBrandRoles),
    });
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const email = String(body.email).trim().toLowerCase();
    if (brand.members.some((candidate) => candidate.email.toLowerCase() === email)) throw new MockHttpError(409, "MEMBER_EXISTS", "That person is already on the brand team.");
    if (brand.members.length >= maximumBrandMembers) throw new MockHttpError(409, "MEMBER_LIMIT_REACHED", `A brand team can have up to ${maximumBrandMembers} people.`);
    if (body.role === "admin" && member.role !== "owner") throw new MockHttpError(403, "BRAND_ROLE_FORBIDDEN", "Only the brand owner can add admins.");
    const existingUser = readMockDatabase().users.find((user) => user.email === email);
    const newMember: BrandMember = { id: createMockIdentifier("bmem"), userId: existingUser?.id ?? null, name: String(body.name).trim(), email, role: body.role as BrandMemberRole, status: "invited" };
    brand.members.push(newMember);
    recordBrandAuditEntry(principal, "brand.member_invited", brand.id, `Invited ${newMember.name} to ${brand.name} as ${newMember.role}`);
    return respondWithJson(201, newMember);
  });

  registerMockRoute("PATCH", "/seller/brands/:brandId/members/:memberId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { brand, member } = findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId);
    requireBrandRole(member, ["owner", "admin"], "change roles");
    const target = brand.members.find((candidate) => candidate.id === request.params.memberId);
    if (!target) throw new MockHttpError(404, "MEMBER_NOT_FOUND", "That person is not on the brand team.");
    const role = readJsonObjectBody(request).role;
    if (!assignableBrandRoles.includes(role as BrandMemberRole)) return respondWithValidationFailure([{ path: "role", message: "Choose admin, editor or viewer." }]);
    if (target.role === "owner") throw new MockHttpError(409, "OWNER_ROLE_LOCKED", "The brand owner's role cannot be changed here.");
    if (target.id === member.id) throw new MockHttpError(409, "OWN_ROLE_LOCKED", "You cannot change your own role.");
    if ((role === "admin" || target.role === "admin") && member.role !== "owner") throw new MockHttpError(403, "BRAND_ROLE_FORBIDDEN", "Only the brand owner can make or change admins.");
    const updatedMember: BrandMember = { ...target, role: role as BrandMemberRole };
    brand.members = brand.members.map((candidate) => (candidate.id === target.id ? updatedMember : candidate));
    recordBrandAuditEntry(principal, "brand.member_role_changed", brand.id, `${target.name} is now ${updatedMember.role} on ${brand.name}`);
    return respondWithJson(200, updatedMember);
  });

  registerMockRoute("DELETE", "/seller/brands/:brandId/members/:memberId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { brand, member } = findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId);
    requireBrandRole(member, ["owner", "admin"], "remove team members");
    const target = brand.members.find((candidate) => candidate.id === request.params.memberId);
    if (!target) throw new MockHttpError(404, "MEMBER_NOT_FOUND", "That person is not on the brand team.");
    if (target.role === "owner") throw new MockHttpError(409, "OWNER_ROLE_LOCKED", "The brand owner cannot be removed.");
    if (target.id === member.id) throw new MockHttpError(409, "CANNOT_REMOVE_SELF", "Ask another admin or the owner to remove you.");
    if (target.role === "admin" && member.role !== "owner") throw new MockHttpError(403, "BRAND_ROLE_FORBIDDEN", "Only the brand owner can remove admins.");
    brand.members = brand.members.filter((candidate) => candidate.id !== target.id);
    recordBrandAuditEntry(principal, "brand.member_removed", brand.id, `Removed ${target.name} from ${brand.name}`);
    return respondWithNoContent();
  });
}
