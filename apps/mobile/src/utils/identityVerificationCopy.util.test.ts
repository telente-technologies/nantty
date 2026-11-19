import { availableIdentityVerificationMethods } from "./identityVerificationCopy.util";
import type { IdentityDocumentTypes } from "@/types/identityVerification.type";

describe("identity verification method selection", () => {
  it("keeps all returned Nigerian NIN formats separate from photo IDs and excludes bank lookups", () => {
    const catalog: IdentityDocumentTypes = {
      country: "NG",
      documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }],
      enhancedDocumentTypes: [],
      idNumberTypes: [
        { country: "NG", type: "NIN_V2", label: "National ID number", regex: "^\\d{11}$" },
        { country: "NG", type: "NIN_SLIP", label: "NIN slip", regex: "" },
        { country: "NG", type: "V_NIN", label: "Virtual NIN", regex: "^[a-zA-Z0-9]{16}$" },
        { country: "NG", type: "BANK_ACCOUNT", label: "Bank account", regex: "", bankCode: "001" },
        { country: "NG", type: "LOOKUP", label: "Bank lookup", regex: "", requiredFields: ["bank_code"] },
        { country: "GH", type: "GHANA_CARD", label: "Ghana Card", regex: "" },
      ],
      availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: true },
    };

    expect(availableIdentityVerificationMethods(catalog).map(({ verificationMethod, verificationProduct, types }) => ({
      verificationMethod,
      verificationProduct,
      codes: types.map(({ code }) => code),
    }))).toEqual([
      { verificationMethod: "document", verificationProduct: "document_verification", codes: ["PASSPORT"] },
      { verificationMethod: "id_number", verificationProduct: "enhanced_kyc", codes: ["NIN_V2", "NIN_SLIP", "V_NIN"] },
    ]);
  });

  it("hides Enhanced Document Verification unless a live entitlement status is available", () => {
    const catalog: IdentityDocumentTypes = {
      country: "KE",
      documentTypes: [],
      enhancedDocumentTypes: [{ code: "NATIONAL_ID", name: "National ID", hasBack: false }],
      idNumberTypes: [],
      availability: { documentVerification: false, enhancedDocumentVerification: true, idNumberVerification: false },
    };

    expect(availableIdentityVerificationMethods(catalog)).toEqual([]);
    expect(availableIdentityVerificationMethods({ ...catalog, enhancedDocumentEntitlementStatus: "unavailable" })).toEqual([]);
    expect(availableIdentityVerificationMethods({ ...catalog, enhancedDocumentEntitlementStatus: "available" }).map(({ verificationProduct }) => verificationProduct))
      .toEqual(["enhanced_document_verification"]);
  });
});
