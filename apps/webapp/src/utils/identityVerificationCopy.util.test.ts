import assert from "node:assert/strict";
import test from "node:test";

import { availableIdentityVerificationMethods, describeDocumentType, filterIdentityCountries, sortIdentityCountries } from "./identityVerificationCopy.util";
import type { IdentityDocumentTypes } from "@/types/identityVerification.type";

test("identity verification explains supported Nigerian NIN variants without implying partner activation", () => {
  assert.equal(describeDocumentType("NIN_V2"), "National ID number (NIN, 11 digits)");
  assert.equal(describeDocumentType("NIN_SLIP"), "NIN slip (11-digit number)");
  assert.equal(describeDocumentType("V_NIN"), "Virtual NIN (16-character code)");
});

test("identity verification keeps provider labels for otherwise unknown catalog types", () => {
  assert.equal(describeDocumentType("RESIDENCY_CARD", "Permanent residency card"), "Permanent residency card");
});

test("identity country ordering is alphabetical and does not mutate the server catalog", () => {
  const source = [{ code: "NG", name: "Nigeria" }, { code: "US", name: "United States" }, { code: "GH", name: "Ghana" }];
  const sorted = sortIdentityCountries(source);

  assert.deepEqual(sorted.map(({ code }) => code), ["GH", "NG", "US"]);
  assert.deepEqual(source.map(({ code }) => code), ["NG", "US", "GH"]);
});

test("identity country search matches provider country names and ISO codes without adding countries", () => {
  const catalog = [{ code: "NG", name: "Nigeria" }, { code: "US", name: "United States" }, { code: "GH", name: "Ghana" }];

  assert.deepEqual(filterIdentityCountries(catalog, "united"), [catalog[1]]);
  assert.deepEqual(filterIdentityCountries(catalog, "ng"), [catalog[0]]);
  assert.deepEqual(filterIdentityCountries(catalog, "  "), catalog);
  assert.deepEqual(filterIdentityCountries(catalog, "Atlantis"), []);
});

test("identity methods keep photo documents, authority checks, and ID-number checks on separate products", () => {
  const catalog: IdentityDocumentTypes = {
    country: "NG",
    documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }],
    enhancedDocumentTypes: [{ code: "VOTER_ID", name: "Voter ID", hasBack: false }],
    idNumberTypes: [
      { country: "NG", type: "NIN_V2", label: "National ID number", regex: "^\\d{11}$" },
      { country: "NG", type: "NIN_SLIP", label: "NIN slip", regex: "^\\d{11}$" },
      { country: "NG", type: "V_NIN", label: "Virtual NIN", regex: "^[a-zA-Z0-9]{16}$" },
    ],
    availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: true },
    enhancedDocumentEntitlementStatus: "available",
  };

  assert.deepEqual(availableIdentityVerificationMethods(catalog).map(({ verificationMethod, verificationProduct, types }) => ({
    verificationMethod,
    verificationProduct,
    codes: types.map(({ code }) => code),
  })), [
    { verificationMethod: "document", verificationProduct: "document_verification", codes: ["PASSPORT"] },
    { verificationMethod: "document", verificationProduct: "enhanced_document_verification", codes: ["VOTER_ID"] },
    { verificationMethod: "id_number", verificationProduct: "enhanced_kyc", codes: ["NIN_V2", "NIN_SLIP", "V_NIN"] },
  ]);
});

test("identity UI hides a provider method unless it is enabled and has catalog types", () => {
  const catalog: IdentityDocumentTypes = {
    country: "US",
    documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }],
    enhancedDocumentTypes: [{ code: "STATE_ID", name: "State ID", hasBack: false }],
    idNumberTypes: [{ country: "US", type: "TAX_ID", label: "Tax ID", regex: "" }],
    availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: true },
  };

  assert.deepEqual(availableIdentityVerificationMethods(catalog).map(({ verificationProduct }) => verificationProduct), ["document_verification", "enhanced_kyc"]);
  assert.deepEqual(availableIdentityVerificationMethods({ ...catalog, documentTypes: [], idNumberTypes: [] }), []);
  assert.deepEqual(availableIdentityVerificationMethods(undefined), []);
});

test("identity UI never offers an ID-number type returned for a different country", () => {
  const catalog: IdentityDocumentTypes = {
    country: "NG",
    documentTypes: [],
    enhancedDocumentTypes: [],
    idNumberTypes: [
      { country: "NG", type: "NIN_SLIP", label: "NIN slip", regex: "" },
      { country: "GH", type: "NATIONAL_ID", label: "Ghana Card", regex: "" },
    ],
    availability: { documentVerification: false, enhancedDocumentVerification: false, idNumberVerification: true },
  };

  assert.deepEqual(availableIdentityVerificationMethods(catalog).map(({ types }) => types.map(({ code }) => code)), [["NIN_SLIP"]]);
});

test("identity UI excludes bank-account lookups from personal ID-number methods", () => {
  const catalog: IdentityDocumentTypes = {
    country: "NG",
    documentTypes: [],
    enhancedDocumentTypes: [],
    idNumberTypes: [
      { country: "NG", type: "NIN_SLIP", label: "NIN slip", regex: "" },
      { country: "NG", type: "BANK_ACCOUNT", label: "Bank account", regex: "", bankCode: "001" },
      { country: "NG", type: "LOOKUP", label: "Bank lookup", regex: "", requiredFields: ["bank_code"] },
    ],
    availability: { documentVerification: false, enhancedDocumentVerification: false, idNumberVerification: true },
  };

  assert.deepEqual(availableIdentityVerificationMethods(catalog).map(({ types }) => types.map(({ code }) => code)), [["NIN_SLIP"]]);
});

test("identity UI fails closed when Enhanced Document Verification entitlement lookup is unavailable", () => {
  const catalog: IdentityDocumentTypes = {
    country: "KE",
    documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }],
    enhancedDocumentTypes: [{ code: "NATIONAL_ID", name: "National ID", hasBack: false }],
    idNumberTypes: [],
    availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: false },
    enhancedDocumentEntitlementStatus: "unavailable",
  };

  assert.deepEqual(availableIdentityVerificationMethods(catalog).map(({ verificationProduct }) => verificationProduct), ["document_verification"]);
});

test("identity UI fails closed when Enhanced Document Verification entitlement status is missing or unconfigured", () => {
  const catalog: IdentityDocumentTypes = {
    country: "ZA",
    documentTypes: [],
    enhancedDocumentTypes: [{ code: "IDENTITY_CARD", name: "Identity card", hasBack: true }],
    idNumberTypes: [],
    availability: { documentVerification: false, enhancedDocumentVerification: true, idNumberVerification: false },
  };

  assert.deepEqual(availableIdentityVerificationMethods(catalog), []);
  assert.deepEqual(availableIdentityVerificationMethods({ ...catalog, enhancedDocumentEntitlementStatus: "not_configured" }), []);
});
