import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedDeveloperOrganizationRoute } from "../src/server/developerOrganizationRoutePolicy";

const organizationId = "f7a84dbe-d2eb-4af5-b48d-1c42ffea780b";
const applicationId = "6a018621-a269-43a0-931e-c2c267705378";
const credentialId = "6dfef0c5-1dc2-4e1c-9e9a-1dd88bb872a7";
const basePath = "/api/v1/developer/organizations";

test("allows scoped production credential rotation only as POST", () => {
  const path = [organizationId, "applications", applicationId, "credentials", credentialId, "rotate"];
  assert.equal(isAllowedDeveloperOrganizationRoute("POST", path, basePath), true);
  assert.equal(isAllowedDeveloperOrganizationRoute("GET", path, basePath), false);
  assert.equal(isAllowedDeveloperOrganizationRoute("DELETE", path, basePath), false);
  assert.equal(isAllowedDeveloperOrganizationRoute("POST", [...path.slice(0, 5), "unknown"], basePath), false);
  assert.equal(isAllowedDeveloperOrganizationRoute("POST", [organizationId, "applications", "not-an-id", "credentials", credentialId, "rotate"], basePath), false);
});

