import { buildDemoStaffRecord } from "@/mocks/seed/demoPeople.mock";
import { buildDemoStoreSettingsFromBasics } from "@/mocks/seed/demoStoreSettings.mock";
import type { DemoStoreProfile } from "@/mocks/seed/demoStoreProfile.mock";

const kelechiKicksStoreId = "store_kelechi_kicks";
const shoeSizes = ["40", "41", "42", "43", "44", "45"];

export const kelechiKicksStoreProfile: DemoStoreProfile = {
  storeId: kelechiKicksStoreId,
  recordKey: "kicks",
  receiptPrefix: "KK",
  randomSeeds: { products: 11_042_026, onlineOrders: 929 },
  buildSettings: () =>
    buildDemoStoreSettingsFromBasics({
      storeId: kelechiKicksStoreId,
      name: "Kelechi Kicks",
      handle: "kelechi.kicks",
      description: "Handmade Aba leather shoes and clean everyday sneakers.",
      country: "NG",
      currency: "NGN",
      timezone: "Africa/Lagos",
      locale: "en-NG",
      phone: "+234 807 555 0155",
      email: "orders@kelechikicks.ng",
      address: "Shop 14, Ariaria International Market, Aba, Abia",
      taxes: [{ id: "tax_vat", name: "VAT", rateBasisPoints: 750, isDefault: true, appliesToCategoryIds: null }],
      returnPolicy: "Size exchanges within 7 days if the shoes are unworn and in the box.",
      shippingPolicy: "We ship from Aba nationwide in 2–5 working days. Abia and Enugu orders often arrive next day.",
      loyalty: { enabled: true, spendRequiredPerPointMinor: 200_000, redeemValuePerPointMinor: 1_000, minimumPointsToRedeem: 50 },
    }),
  buildLocations: () => [
    { id: "loc_kicks_ariaria", name: "Ariaria shop", kind: "store", address: "Shop 14, Ariaria International Market", city: "Aba", state: "Abia", country: "NG", phone: "+234 807 555 0155", isDefault: true, active: true },
  ],
  buildCategories: () => [
    { id: "cat_leather_shoes", name: "Leather shoes" },
    { id: "cat_sneakers", name: "Sneakers" },
    { id: "cat_shoe_care", name: "Shoe care" },
  ],
  buildStaff: () => [
    buildDemoStaffRecord({ id: "stf_kelechi", userId: "usr_kelechi", name: "Kelechi Obi", username: "kelechi.kicks", role: "owner", locationIds: ["loc_kicks_ariaria"] }, 0),
    buildDemoStaffRecord({ id: "stf_emeka_kicks", userId: "usr_emeka", name: "Emeka Nnaji", username: "emeka.sells", role: "sales", locationIds: ["loc_kicks_ariaria"] }, 1),
  ],
  buildPromotions: () => [],
  catalog: {
    blueprints: [
      { key: "leather-loafers", name: "Handmade Leather Loafers", categoryId: "cat_leather_shoes", categoryName: "Leather shoes", unsplashPhotoId: "1616406432452-07bc5938759d", priceMajor: 42000, costMajor: 21000, description: "Full-grain leather penny loafers, stitched in Aba.", options: [{ name: "Size", values: shoeSizes }], tags: ["made-in-nigeria", "bestseller"] },
      { key: "white-low-tops", name: "Classic White Low-Top Sneakers", categoryId: "cat_sneakers", categoryName: "Sneakers", unsplashPhotoId: "1636262899511-dc5865c774dc", priceMajor: 35000, costMajor: 19000, description: "Clean white leather low-tops with a cushioned insole.", options: [{ name: "Size", values: shoeSizes }] },
      { key: "palm-slides", name: "Leather Palm Slides", categoryId: "cat_leather_shoes", categoryName: "Leather shoes", unsplashPhotoId: "1785357692053-19e30011d790", priceMajor: 20000, costMajor: 9000, description: "Everyday leather slides with a moulded footbed.", options: [{ name: "Size", values: ["41", "42", "43", "44"] }], tags: ["made-in-nigeria"] },
      { key: "suede-chelsea-boots", name: "Suede Chelsea Boots", categoryId: "cat_leather_shoes", categoryName: "Leather shoes", unsplashPhotoId: "1788478963160-1c38139e2932", priceMajor: 60000, costMajor: 33000, description: "Tan suede Chelsea boots with elastic side panels.", options: [{ name: "Size", values: ["41", "42", "43", "44", "45"] }] },
      { key: "running-trainers", name: "Lightweight Running Trainers", categoryId: "cat_sneakers", categoryName: "Sneakers", unsplashPhotoId: "1555972635-8a10402b49b2", priceMajor: 40000, costMajor: 23500, description: "Breathable mesh trainers for road runs and the gym.", options: [{ name: "Size", values: shoeSizes }] },
      { key: "leather-care-kit", name: "Leather Care Kit", categoryId: "cat_shoe_care", categoryName: "Shoe care", unsplashPhotoId: null, priceMajor: 8500, costMajor: 3500, description: "Cream polish, horsehair brush and a soft cloth." },
      { key: "sneaker-cleaner", name: "Sneaker Cleaning Foam", categoryId: "cat_shoe_care", categoryName: "Shoe care", unsplashPhotoId: null, priceMajor: 5000, costMajor: 2000, description: "Waterless foam cleaner for leather, mesh and suede." },
    ],
    skuPrefix: "KK",
    barcodeCompanyDigits: "6152",
    stockLocationIds: ["loc_kicks_ariaria"],
    bulkStockLocationId: null,
    highVolumeCategoryIds: ["cat_shoe_care"],
    brandTagsByProductKey: {},
  },
  customers: {
    rows: [
      ["Chinedu Okeke", "+2348031237701", "chinedu@okeke.dev", "chinedu.codes", [], 120],
      ["Segun Afolabi", "+2348091237702", null, "segunfitness", ["runner"], 80],
      ["Ugochi Nwafor", "+2348061237703", null, null, [], 40],
      ["Obinna Eze", "+2348121237704", "obinna.eze@gmail.com", null, ["wholesale"], 300],
    ],
    firstCustomerNote: null,
  },
  onlineOrders: {
    orderCount: 9,
    historyLengthInDays: 21,
    firstOrderNumber: 58520,
    buyers: [
      { id: "usr_segun", name: "Segun Afolabi", username: "segunfitness", city: "Ibadan", state: "Oyo" },
      { id: "usr_chinedu", name: "Chinedu Okeke", username: "chinedu.codes", city: "Wuse", state: "FCT" },
      { id: "usr_kelechi_eze", name: "Kelechi Eze", username: "kelechi_ez", city: "Ikeja", state: "Lagos" },
      { id: "usr_olumide", name: "Olumide Johnson", username: "olumide.j", city: "Victoria Island", state: "Lagos" },
    ],
    creators: [],
    creatorShare: 0,
    fulfilmentLocationId: "loc_kicks_ariaria",
    disputedOrderIndex: 3,
    disputeBuyerMessage: "I ordered size 43 but the box has size 42.",
    homeState: "Abia",
    shippingFeeMinor: { homeState: 150_000, otherStates: 350_000 },
    returnReasons: ["Too tight at the toe"],
  },
  wallet: {
    payoutAccounts: [{ id: "pac_kicks_access", bankName: "Access Bank", bankCode: "044", accountNameMasked: "KELECHI K***KS VENT", accountNumberMasked: "******5509", isDefault: true, verified: true }],
    payoutAmountsMinor: [9_800_000],
    payoutFeeMinor: 5_000,
    payoutAccountSummary: "Access Bank ******5509",
    pendingMinor: 1_750_000,
    availableMinor: 6_320_000,
  },
  auditEntries: [
    ["stf_kelechi", "staff.invited", "staff", "Invited Emeka Nnaji as sales staff", 20],
    ["stf_kelechi", "settings.updated", "store", "Uploaded CAC certificate for verification", 2],
  ],
};
