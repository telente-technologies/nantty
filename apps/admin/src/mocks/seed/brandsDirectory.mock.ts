import type { BrandDocumentSummary, BrandMemberRole, BrandStatus, OfficialStoreStatus, TrademarkRegistration } from "@/types/brands.type";

export interface MockBrandOfficialRequest {
  id: string;
  submittedAt: string;
  submittedByUserId: string;
  trademark: TrademarkRegistration;
  cacRegistrationNumber: string;
  cacCompanyName: string;
  contactEmail: string;
  documents: BrandDocumentSummary[];
  lastDecisionReason: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
}

export interface MockBrandLinkedStore {
  id: string;
  storeName: string;
  sellerUserId: string;
  linkedAt: string;
  isVerified: boolean;
  hasOfficialBadge: boolean;
}

export interface MockBrandRecord {
  id: string;
  name: string;
  slug: string;
  logoPhotoId: string | null;
  category: string;
  country: string;
  website: string | null;
  status: BrandStatus;
  officialStatus: OfficialStoreStatus;
  description: string;
  members: { userId: string; role: BrandMemberRole; addedAt: string }[];
  linkedStores: MockBrandLinkedStore[];
  createdAt: string;
  officialRequest: MockBrandOfficialRequest | null;
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNowDateOnly(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function buildStandardDocuments(brandId: string, submittedDaysAgo: number): BrandDocumentSummary[] {
  return [
    { id: `${brandId}_doc_tm`, kind: "TRADEMARK_CERTIFICATE", label: "Trademark registration certificate", uploadedAt: daysAgoIso(submittedDaysAgo) },
    { id: `${brandId}_doc_cac`, kind: "CAC_CERTIFICATE", label: "Certificate of incorporation (CAC)", uploadedAt: daysAgoIso(submittedDaysAgo) },
    { id: `${brandId}_doc_auth`, kind: "AUTHORIZATION_LETTER", label: "Letter authorising the store owner", uploadedAt: daysAgoIso(submittedDaysAgo) },
  ];
}

function buildOfficialRequest(brandId: string, input: { submittedDaysAgo: number; submittedByUserId: string; trademark: TrademarkRegistration; cacRegistrationNumber: string; cacCompanyName: string; contactEmail: string; decided?: { reason: string; daysAgo: number; byName: string } }): MockBrandOfficialRequest {
  return {
    id: `${brandId}_osr`,
    submittedAt: daysAgoIso(input.submittedDaysAgo),
    submittedByUserId: input.submittedByUserId,
    trademark: input.trademark,
    cacRegistrationNumber: input.cacRegistrationNumber,
    cacCompanyName: input.cacCompanyName,
    contactEmail: input.contactEmail,
    documents: buildStandardDocuments(brandId, input.submittedDaysAgo),
    lastDecisionReason: input.decided?.reason ?? null,
    decidedAt: input.decided ? daysAgoIso(input.decided.daysAgo) : null,
    decidedByName: input.decided?.byName ?? null,
  };
}

export function buildDemoBrands(): MockBrandRecord[] {
  return [
    {
      id: "brd_0001", name: "Adire Lagos", slug: "adire-lagos", logoPhotoId: "1661332306744-70f9ed1a7f40", category: "Fashion", country: "NG", website: "https://adirelagos.example.com", status: "ACTIVE", officialStatus: "OFFICIAL",
      description: "Hand-dyed adire and aso-oke ready-to-wear from Abeokuta and Lagos.",
      members: [{ userId: "usr_0001", role: "OWNER", addedAt: daysAgoIso(400) }, { userId: "usr_0028", role: "MEMBER", addedAt: daysAgoIso(90) }],
      linkedStores: [{ id: "sto_1001", storeName: "Adaeze Styles", sellerUserId: "usr_0001", linkedAt: daysAgoIso(390), isVerified: true, hasOfficialBadge: true }],
      createdAt: daysAgoIso(400),
      officialRequest: buildOfficialRequest("brd_0001", { submittedDaysAgo: 200, submittedByUserId: "usr_0001", trademark: { registrationNumber: "NG/TM/O/2021/48213", jurisdiction: "Nigeria Trademarks, Patents and Designs Registry", niceClass: 25, registeredOwner: "Adire Lagos Limited", registeredOn: "2021-06-14", expiresOn: daysFromNowDateOnly(2100) }, cacRegistrationNumber: "RC 1748213", cacCompanyName: "Adire Lagos Limited", contactEmail: "brand@adirelagos.example.com", decided: { reason: "Registration and CAC match; owner is the sole director.", daysAgo: 195, byName: "Chidi Okafor" } }),
    },
    {
      id: "brd_0002", name: "Kemi's Kitchen Foods", slug: "kemis-kitchen-foods", logoPhotoId: "1665332195309-9d75071138f0", category: "Food & groceries", country: "NG", website: "https://kemiskitchen.example.com", status: "ACTIVE", officialStatus: "PENDING",
      description: "Small-batch spice blends, pepper sauce and ready-to-cook jollof kits.",
      members: [{ userId: "usr_0003", role: "OWNER", addedAt: daysAgoIso(300) }, { userId: "usr_0024", role: "ADMIN", addedAt: daysAgoIso(60) }],
      linkedStores: [{ id: "sto_1003", storeName: "Kemi's Kitchen", sellerUserId: "usr_0003", linkedAt: daysAgoIso(290), isVerified: true, hasOfficialBadge: false }],
      createdAt: daysAgoIso(300),
      officialRequest: buildOfficialRequest("brd_0002", { submittedDaysAgo: 3, submittedByUserId: "usr_0003", trademark: { registrationNumber: "NG/TM/O/2023/77120", jurisdiction: "Nigeria Trademarks, Patents and Designs Registry", niceClass: 30, registeredOwner: "Kemi's Kitchen Foods Limited", registeredOn: "2023-02-02", expiresOn: daysFromNowDateOnly(2400) }, cacRegistrationNumber: "RC 1893377", cacCompanyName: "Kemi's Kitchen Foods Limited", contactEmail: "hello@kemiskitchen.example.com" }),
    },
    {
      id: "brd_0003", name: "Funke Naturals", slug: "funke-naturals", logoPhotoId: "1643185450492-6ba77dea00f6", category: "Beauty", country: "NG", website: "https://funkenaturals.example.com", status: "ACTIVE", officialStatus: "PENDING",
      description: "Shea butter, black soap and hair oils made in Oyo.",
      members: [{ userId: "usr_0013", role: "OWNER", addedAt: daysAgoIso(500) }],
      linkedStores: [{ id: "sto_1013", storeName: "Funke Naturals", sellerUserId: "usr_0013", linkedAt: daysAgoIso(480), isVerified: true, hasOfficialBadge: false }, { id: "sto_1024", storeName: "Ngozi Bakes & Beauty", sellerUserId: "usr_0024", linkedAt: daysAgoIso(40), isVerified: false, hasOfficialBadge: false }],
      createdAt: daysAgoIso(500),
      officialRequest: buildOfficialRequest("brd_0003", { submittedDaysAgo: 6, submittedByUserId: "usr_0013", trademark: { registrationNumber: "TM-2019-5531", jurisdiction: "WIPO (Madrid System)", niceClass: 3, registeredOwner: "Funke Naturals Enterprises", registeredOn: "2016-01-20", expiresOn: daysFromNowDateOnly(-12) }, cacRegistrationNumber: "BN 3310421", cacCompanyName: "Funke Naturals Ventures", contactEmail: "funkenaturals.orders@gmail.example.com" }),
    },
    {
      id: "brd_0004", name: "Halima Modest Wear", slug: "halima-modest-wear", logoPhotoId: "1645827042168-4fb0cdd0bf7e", category: "Fashion", country: "NG", website: null, status: "ACTIVE", officialStatus: "NONE",
      description: "Hijabs, abayas and modest occasion wear.",
      members: [{ userId: "usr_0019", role: "OWNER", addedAt: daysAgoIso(210) }],
      linkedStores: [{ id: "sto_1019", storeName: "Halima Hijabs", sellerUserId: "usr_0019", linkedAt: daysAgoIso(205), isVerified: false, hasOfficialBadge: false }],
      createdAt: daysAgoIso(210),
      officialRequest: null,
    },
    {
      id: "brd_0005", name: "Zobo Republic", slug: "zobo-republic", logoPhotoId: "1587049352851-8d4e89133924", category: "Food & groceries", country: "NG", website: "https://zoborepublic.example.com", status: "ACTIVE", officialStatus: "OFFICIAL",
      description: "Bottled zobo, kunu and tiger-nut drinks.",
      members: [{ userId: "usr_0024", role: "OWNER", addedAt: daysAgoIso(260) }, { userId: "usr_0026", role: "MEMBER", addedAt: daysAgoIso(20) }],
      linkedStores: [{ id: "sto_1124", storeName: "Zobo Republic Official", sellerUserId: "usr_0024", linkedAt: daysAgoIso(255), isVerified: true, hasOfficialBadge: true }],
      createdAt: daysAgoIso(260),
      officialRequest: buildOfficialRequest("brd_0005", { submittedDaysAgo: 120, submittedByUserId: "usr_0024", trademark: { registrationNumber: "NG/TM/O/2022/60318", jurisdiction: "Nigeria Trademarks, Patents and Designs Registry", niceClass: 32, registeredOwner: "Zobo Republic Beverages Limited", registeredOn: "2022-09-01", expiresOn: daysFromNowDateOnly(2800) }, cacRegistrationNumber: "RC 1702245", cacCompanyName: "Zobo Republic Beverages Limited", contactEmail: "legal@zoborepublic.example.com", decided: { reason: "All documents verified with the registry.", daysAgo: 116, byName: "Chidi Okafor" } }),
    },
    {
      id: "brd_0006", name: "Kwame Beats Records", slug: "kwame-beats-records", logoPhotoId: "1502982720700-bfff97f2ecac", category: "Music & merch", country: "GH", website: "https://kwamebeats.example.com", status: "ACTIVE", officialStatus: "REVOKED",
      description: "Afrobeats label merch and vinyl.",
      members: [{ userId: "usr_0007", role: "OWNER", addedAt: daysAgoIso(250) }],
      linkedStores: [{ id: "sto_1007", storeName: "Kwame Beats Merch", sellerUserId: "usr_0007", linkedAt: daysAgoIso(240), isVerified: true, hasOfficialBadge: false }],
      createdAt: daysAgoIso(250),
      officialRequest: buildOfficialRequest("brd_0006", { submittedDaysAgo: 180, submittedByUserId: "usr_0007", trademark: { registrationNumber: "GH/TM/2020/11842", jurisdiction: "Ghana Registrar-General's Department", niceClass: 9, registeredOwner: "KB Records Ltd", registeredOn: "2020-03-11", expiresOn: daysFromNowDateOnly(1500) }, cacRegistrationNumber: "CS 118420221", cacCompanyName: "KB Records Ltd", contactEmail: "label@kwamebeats.example.com", decided: { reason: "Trademark assignment to a third party confirmed by the registry.", daysAgo: 14, byName: "Tolu Adeyemi" } }),
    },
  ];
}
