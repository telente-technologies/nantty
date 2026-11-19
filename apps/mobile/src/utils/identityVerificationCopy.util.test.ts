import { availableIdentityVerificationMethods } from "./identityVerificationCopy.util";
import type { IdentityDocumentTypes } from "@/types/identityVerification.type";

describe("identity verification method selection", () => {
  it("keeps personal ID checks and photo IDs distinct and excludes bank lookups", () => {
    const catalog: IdentityDocumentTypes = {
      country: "NG",
      documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }],
      enhancedDocumentTypes: [],
      idNumberTypes: [
        { country: "NG", type: "NIN_SLIP", label: "NIN slip", regex: "" },
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
      { verificationMethod: "id_number", verificationProduct: "enhanced_kyc", codes: ["NIN_SLIP"] },
    ]);
  });
});
