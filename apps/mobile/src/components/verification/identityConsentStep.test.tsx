import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

const mockCountries = jest.fn();
const mockTypes = jest.fn();

jest.mock("@/services/auth/identityVerification.service", () => ({
  identityVerificationService: {
    listDocumentCountries: () => mockCountries(),
    listDocumentTypes: (country: string) => mockTypes(country),
  },
}));
jest.mock("@/components/ui/button", () => ({ Button: ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) => { const React = jest.requireActual<typeof import("react")>("react"); const RN = jest.requireActual<typeof import("react-native")>("react-native"); return React.createElement(RN.Pressable, { accessibilityRole: "button", accessibilityState: { disabled }, onPress }, React.createElement(RN.Text, null, title)); } }));
jest.mock("@/components/ui/chip", () => ({ Chip: ({ label, onPress }: { label: string; onPress: () => void }) => { const React = jest.requireActual<typeof import("react")>("react"); const RN = jest.requireActual<typeof import("react-native")>("react-native"); return React.createElement(RN.Pressable, { accessibilityRole: "button", onPress }, React.createElement(RN.Text, null, label)); } }));
jest.mock("@/components/settings/geoPickerField", () => ({ GeoPickerField: ({ options, onSelect }: { options: readonly { id: string; name: string }[]; onSelect: (option: { id: string; name: string }) => void }) => { const React = jest.requireActual<typeof import("react")>("react"); const RN = jest.requireActual<typeof import("react-native")>("react-native"); return React.createElement(RN.View, null, ...options.map((option) => React.createElement(RN.Pressable, { key: option.id, accessibilityRole: "button", onPress: () => onSelect(option) }, React.createElement(RN.Text, null, option.name)))); } }));
jest.mock("@/components/ui/input", () => ({ TextField: () => null }));
jest.mock("@/components/ui/text", () => ({ Text: ({ children }: { children: ReactNode }) => { const React = jest.requireActual<typeof import("react")>("react"); const RN = jest.requireActual<typeof import("react-native")>("react-native"); return React.createElement(RN.Text, null, children); } }));
jest.mock("@/theme", () => ({ useTheme: () => ({ colors: { textMuted: "muted", link: "link", error: "error", surface: "surface", primary: "primary" } }), makeThemedStyles: (factory: (colors: Record<string, string>) => unknown) => () => factory({ textMuted: "muted", link: "link", error: "error", surface: "surface", primary: "primary" }) }));
jest.mock("@/utils/identityVerificationCopy.util", () => {
  const actual = jest.requireActual<typeof import("@/utils/identityVerificationCopy.util")>("@/utils/identityVerificationCopy.util");
  return { ...actual, biometricConsentPoints: [] };
});

import { IdentityConsentStep } from "./identityConsentStep";

describe("IdentityConsentStep international ID choices", () => {
  beforeEach(() => {
    mockCountries.mockReset();
    mockTypes.mockReset();
    mockCountries.mockResolvedValue({ countries: [{ code: "GH", name: "Ghana" }, { code: "NG", name: "Nigeria" }, { code: "US", name: "United States" }], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: true } });
    mockTypes.mockImplementation(async (country: string) => country === "NG"
      ? { country, documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [{ code: "VOTER_ID", name: "Voter's ID", hasBack: false }], idNumberTypes: [{ country, type: "NIN_V2", label: "National Identification Number", regex: "" }, { country, type: "NIN_SLIP", label: "NIN Slip", regex: "" }, { country, type: "V_NIN", label: "Virtual NIN", regex: "" }], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: true }, enhancedDocumentEntitlementStatus: "available" }
      : country === "GH"
      ? { country, documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [], idNumberTypes: [{ country, type: "NATIONAL_ID", label: "Ghana Card", regex: "" }], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: true } }
      : { country, documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [], idNumberTypes: [], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: false } });
  });

  it("offers account-enabled global photo ID and Nigeria ID-number routes without collecting the number", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient.setQueryData(["verification", "documentCountries"], { countries: [{ code: "NG", name: "Nigeria" }, { code: "US", name: "United States" }], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: true } });
    queryClient.setQueryData(["verification", "documentTypes", "US"], { country: "US", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [], idNumberTypes: [], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: false } });
    queryClient.setQueryData(["verification", "documentTypes", "NG"], { country: "NG", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [{ code: "VOTER_ID", name: "Voter's ID", hasBack: false }], idNumberTypes: [{ country: "NG", type: "NIN_V2", label: "National Identification Number", regex: "" }, { country: "NG", type: "NIN_SLIP", label: "NIN Slip", regex: "" }, { country: "NG", type: "V_NIN", label: "Virtual NIN", regex: "" }], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: true }, enhancedDocumentEntitlementStatus: "available" });
    const onStart = jest.fn();
    const view = await render(createElement(QueryClientProvider, { client: queryClient }, createElement(IdentityConsentStep, { starting: false, errorMessage: null, privacyPolicyUrl: "https://nantty.com/privacy", onStart })));

    await act(async () => fireEvent.press(screen.getByRole("button", { name: "United States" })));
    await waitFor(() => expect(screen.getByText("Passport")).toBeTruthy());

    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Nigeria" })));
    await waitFor(() => expect(screen.getByRole("button", { name: "ID number (secure Smile ID check)" })).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "ID number (secure Smile ID check)" })));
    expect(screen.getByText("National ID number (NIN, 11 digits)")).toBeTruthy();
    expect(screen.getByText("NIN slip (11-digit number)")).toBeTruthy();
    expect(screen.getByText("Virtual NIN (16-character code)")).toBeTruthy();
    expect(screen.getByText(/You enter the number on Smile ID's secure page/)).toBeTruthy();
    expect(onStart).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "National ID number (NIN, 11 digits)" })));
    await act(async () => fireEvent.press(screen.getByRole("checkbox")));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Continue to identity check" })));
    expect(onStart).toHaveBeenCalledWith({ verificationMethod: "id_number", verificationProduct: "enhanced_kyc", documentCountry: "NG", documentType: "NIN_V2" });
    view.unmount();
    queryClient.clear();
  });

  it("shows Enhanced Document Verification only for configured authority-check documents", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient.setQueryData(["verification", "documentCountries"], { countries: [{ code: "NG", name: "Nigeria" }], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: true } });
    queryClient.setQueryData(["verification", "documentTypes", "NG"], { country: "NG", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [{ code: "VOTER_ID", name: "Voter's ID", hasBack: false }], idNumberTypes: [], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: false }, enhancedDocumentEntitlementStatus: "available" });
    const onStart = jest.fn();
    await render(createElement(QueryClientProvider, { client: queryClient }, createElement(IdentityConsentStep, { starting: false, errorMessage: null, privacyPolicyUrl: "https://nantty.com/privacy", onStart })));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Nigeria" })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Selfie + photo ID with authority check" })).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Selfie + photo ID with authority check" })));
    expect(screen.getByText("Voter's ID")).toBeTruthy();
    expect(screen.getByText(/checking the document details with the issuing authority/)).toBeTruthy();
    expect(screen.queryByText("Passport")).toBeNull();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Voter's ID" })));
    await act(async () => fireEvent.press(screen.getByRole("checkbox")));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Continue to identity check" })));
    expect(onStart).toHaveBeenCalledWith({ verificationMethod: "document", verificationProduct: "enhanced_document_verification", documentCountry: "NG", documentType: "VOTER_ID" });
    queryClient.clear();
  });

  it("resets the verification method when the issuing country changes", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient.setQueryData(["verification", "documentCountries"], { countries: [{ code: "GH", name: "Ghana" }, { code: "NG", name: "Nigeria" }], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: true } });
    queryClient.setQueryData(["verification", "documentTypes", "NG"], { country: "NG", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [], idNumberTypes: [{ country: "NG", type: "NIN_SLIP", label: "NIN Slip", regex: "" }], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: true } });
    queryClient.setQueryData(["verification", "documentTypes", "GH"], { country: "GH", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [], idNumberTypes: [{ country: "GH", type: "NATIONAL_ID", label: "Ghana Card", regex: "" }], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: true } });
    const onStart = jest.fn();
    await render(createElement(QueryClientProvider, { client: queryClient }, createElement(IdentityConsentStep, { starting: false, errorMessage: null, privacyPolicyUrl: "https://nantty.com/privacy", onStart })));

    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Nigeria" })));
    await waitFor(() => expect(screen.getByRole("button", { name: "ID number (secure Smile ID check)" })).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "ID number (secure Smile ID check)" })));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Ghana" })));
    await waitFor(() => expect(screen.getByText("Passport")).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Passport" })));
    await act(async () => fireEvent.press(screen.getByRole("checkbox")));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Continue to identity check" })));

    expect(onStart).toHaveBeenCalledWith({ verificationMethod: "document", verificationProduct: "document_verification", documentCountry: "GH", documentType: "PASSPORT" });
    queryClient.clear();
  });

  it("requires fresh consent when the selected verification method changes", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient.setQueryData(["verification", "documentCountries"], { countries: [{ code: "NG", name: "Nigeria" }], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: true } });
    queryClient.setQueryData(["verification", "documentTypes", "NG"], { country: "NG", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [], idNumberTypes: [{ country: "NG", type: "NIN_V2", label: "National Identification Number", regex: "" }], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: true } });
    const onStart = jest.fn();
    await render(createElement(QueryClientProvider, { client: queryClient }, createElement(IdentityConsentStep, { starting: false, errorMessage: null, privacyPolicyUrl: "https://nantty.com/privacy", onStart })));

    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Nigeria" })));
    await waitFor(() => expect(screen.getByText("Passport")).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Passport" })));
    await act(async () => fireEvent.press(screen.getByRole("checkbox")));
    expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(true);

    await act(async () => fireEvent.press(screen.getByRole("button", { name: "ID number (secure Smile ID check)" })));
    expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(false);
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Continue to identity check" })));
    expect(onStart).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it("does not submit a previously selected ID after the provider catalog removes it", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    mockTypes.mockImplementation(async (country: string) => country === "NG"
      ? { country, documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [], idNumberTypes: [{ country, type: "NIN_V2", label: "National Identification Number", regex: "" }], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: true } }
      : { country, documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [], idNumberTypes: [], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: false } });
    queryClient.setQueryData(["verification", "documentCountries"], { countries: [{ code: "NG", name: "Nigeria" }], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: true } });
    queryClient.setQueryData(["verification", "documentTypes", "NG"], { country: "NG", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [], idNumberTypes: [{ country: "NG", type: "NIN_V2", label: "National Identification Number", regex: "" }], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: true } });
    const onStart = jest.fn();
    await render(createElement(QueryClientProvider, { client: queryClient }, createElement(IdentityConsentStep, { starting: false, errorMessage: null, privacyPolicyUrl: "https://nantty.com/privacy", onStart })));

    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Nigeria" })));
    await waitFor(() => expect(screen.getByRole("button", { name: "ID number (secure Smile ID check)" })).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "ID number (secure Smile ID check)" })));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "National ID number (NIN, 11 digits)" })));
    await act(async () => fireEvent.press(screen.getByRole("checkbox")));

    mockTypes.mockImplementation(async (country: string) => ({ country, documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [], idNumberTypes: [], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: false } }));
    await act(async () => { queryClient.setQueryData(["verification", "documentTypes", "NG"], { country: "NG", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [], idNumberTypes: [], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: false } }); });
    await waitFor(() => expect(screen.queryByText("National ID number (NIN, 11 digits)")).toBeNull());
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Continue to identity check" })));
    expect(onStart).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it("hides stale catalog choices when refreshing country or product availability fails", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient.setQueryData(["verification", "documentCountries"], { countries: [{ code: "NG", name: "Nigeria" }], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: true } });
    queryClient.setQueryData(["verification", "documentTypes", "NG"], { country: "NG", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [{ code: "VOTER_ID", name: "Voter ID", hasBack: false }], idNumberTypes: [{ country: "NG", type: "NIN_SLIP", label: "NIN Slip", regex: "" }], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: true } });
    mockCountries.mockRejectedValue(new Error("catalog temporarily unavailable"));
    mockTypes.mockRejectedValue(new Error("catalog temporarily unavailable"));
    await render(createElement(QueryClientProvider, { client: queryClient }, createElement(IdentityConsentStep, { starting: false, errorMessage: null, privacyPolicyUrl: "https://nantty.com/privacy", onStart: jest.fn() })));

    await waitFor(() => expect(screen.getByText("We couldn't load supported countries. Try again.")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Nigeria" })).toBeNull();
    expect(screen.queryByText("Passport")).toBeNull();
    expect(screen.queryByText("Voter ID")).toBeNull();
    queryClient.clear();
  });

  it("never shows Enhanced Document Verification when the provider entitlement lookup is unavailable", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient.setQueryData(["verification", "documentCountries"], { countries: [{ code: "NG", name: "Nigeria" }], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: false } });
    queryClient.setQueryData(["verification", "documentTypes", "NG"], { country: "NG", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [{ code: "VOTER_ID", name: "Voter ID", hasBack: false }], idNumberTypes: [], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: false }, enhancedDocumentEntitlementStatus: "unavailable" });
    mockTypes.mockResolvedValueOnce({ country: "NG", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [{ code: "VOTER_ID", name: "Voter ID", hasBack: false }], idNumberTypes: [], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: false }, enhancedDocumentEntitlementStatus: "unavailable" });
    await render(createElement(QueryClientProvider, { client: queryClient }, createElement(IdentityConsentStep, { starting: false, errorMessage: null, privacyPolicyUrl: "https://nantty.com/privacy", onStart: jest.fn() })));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Nigeria" })));
    await waitFor(() => expect(screen.getByText(/couldn't confirm which authority-check IDs are enabled/i)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Selfie + photo ID with authority check" })).toBeNull();
    queryClient.clear();
  });

  it("never shows Enhanced Document Verification when entitlement status is missing", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient.setQueryData(["verification", "documentCountries"], { countries: [{ code: "NG", name: "Nigeria" }], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: false } });
    queryClient.setQueryData(["verification", "documentTypes", "NG"], { country: "NG", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [{ code: "VOTER_ID", name: "Voter ID", hasBack: false }], idNumberTypes: [], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: false } });
    mockTypes.mockResolvedValueOnce({ country: "NG", documentTypes: [{ code: "PASSPORT", name: "Passport", hasBack: false }], enhancedDocumentTypes: [{ code: "VOTER_ID", name: "Voter ID", hasBack: false }], idNumberTypes: [], availability: { documentVerification: true, enhancedDocumentVerification: true, idNumberVerification: false } });
    await render(createElement(QueryClientProvider, { client: queryClient }, createElement(IdentityConsentStep, { starting: false, errorMessage: null, privacyPolicyUrl: "https://nantty.com/privacy", onStart: jest.fn() })));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Nigeria" })));
    await waitFor(() => expect(screen.getByText("Passport")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Selfie + photo ID with authority check" })).toBeNull();
    queryClient.clear();
  });
});
