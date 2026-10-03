import { buildDemoStaffRecord } from "@/mocks/seed/demoPeople.mock";
import { buildDemoStoreSettingsFromBasics } from "@/mocks/seed/demoStoreSettings.mock";
import type { DemoStoreProfile } from "@/mocks/seed/demoStoreProfile.mock";
import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";
import type { ProductBrandTag } from "@/types/brand.type";

const adireLabStudioStoreId = "store_adire_lab_studio";
const adireLabOwnBrandTag: ProductBrandTag = { brandId: "brand_adire_lab", name: "Adire Lab", relationship: "own" };

export const adireLabStudioStoreProfile: DemoStoreProfile = {
  storeId: adireLabStudioStoreId,
  recordKey: "adire",
  receiptPrefix: "ADL",
  randomSeeds: { products: 31_052_026, onlineOrders: 818 },
  buildSettings: () =>
    buildDemoStoreSettingsFromBasics({
      storeId: adireLabStudioStoreId,
      name: "Adire Lab Studio",
      handle: "adirelab.studio",
      description: "Hand-dyed adire and Ankara ready-to-wear, dyed in Abeokuta and finished in our Yaba studio.",
      country: "NG",
      currency: "NGN",
      timezone: "Africa/Lagos",
      locale: "en-NG",
      phone: "+234 803 555 0268",
      email: "studio@adirelab.ng",
      address: "21 Herbert Macaulay Way, Yaba, Lagos",
      taxes: [{ id: "tax_vat", name: "VAT", rateBasisPoints: 750, isDefault: true, appliesToCategoryIds: null }],
      returnPolicy: "Exchanges within 5 days with proof of purchase. Custom and altered pieces cannot be returned.",
      shippingPolicy: "Lagos deliveries in 1–2 days. Custom pieces ship within 7 working days of your order.",
      loyalty: { enabled: false, spendRequiredPerPointMinor: 100_000, redeemValuePerPointMinor: 1_000, minimumPointsToRedeem: 100 },
    }),
  buildLocations: () => [
    { id: "loc_adire_yaba", name: "Yaba studio", kind: "store", address: "21 Herbert Macaulay Way", city: "Yaba", state: "Lagos", country: "NG", phone: "+234 803 555 0268", isDefault: true, active: true },
    { id: "loc_adire_abeokuta", name: "Abeokuta dye workshop", kind: "warehouse", address: "Itoku Market Road", city: "Abeokuta", state: "Ogun", country: "NG", phone: null, isDefault: false, active: true },
  ],
  buildCategories: () => [
    { id: "cat_womenswear", name: "Womenswear" },
    { id: "cat_menswear", name: "Menswear" },
    { id: "cat_accessories", name: "Accessories" },
    { id: "cat_textiles", name: "Fabric & home textiles" },
  ],
  buildStaff: () => [
    buildDemoStaffRecord({ id: "stf_adaeze_adire", userId: "usr_adaeze", name: "Adaeze Okafor", username: "adaeze.okafor", role: "owner", locationIds: ["loc_adire_yaba", "loc_adire_abeokuta"] }, 0),
    buildDemoStaffRecord({ id: "stf_toyin_adire", userId: "usr_toyin", name: "Toyin Afolabi", username: "toyin.afolabi", role: "manager", locationIds: ["loc_adire_yaba", "loc_adire_abeokuta"] }, 0),
    buildDemoStaffRecord({ id: "stf_zainab_adire", userId: "usr_zainab", name: "Zainab Yusuf", username: "zainab.yusuf", role: "sales", locationIds: ["loc_adire_yaba"] }, 0),
  ],
  buildPromotions: (currency) => [
    { id: "promo_adire_first", name: "First adire 10%", kind: "coupon", code: "ADIRE10", discount: { kind: "percent", value: 1000 }, scope: { kind: "all", ids: [] }, minimumSpend: { amountMinor: 2_000_000, currency }, usageLimit: null, usageLimitPerCustomer: 1, usedCount: 9, startsAt: buildIsoDateDaysAgo(40), endsAt: null, status: "active", createdAt: buildIsoDateDaysAgo(40) },
    { id: "promo_adire_owambe", name: "Owambe season", kind: "scheduled_sale", code: null, discount: { kind: "percent", value: 1500 }, scope: { kind: "categories", ids: ["cat_accessories"] }, minimumSpend: null, usageLimit: null, usageLimitPerCustomer: null, usedCount: 0, startsAt: buildIsoDateDaysAgo(-14, 0), endsAt: buildIsoDateDaysAgo(-28, 23), status: "scheduled", createdAt: buildIsoDateDaysAgo(2) },
  ],
  catalog: {
    blueprints: [
      { key: "ankara-wrap-dress", name: "Ankara Wrap Midi Dress", categoryId: "cat_womenswear", categoryName: "Womenswear", unsplashPhotoId: "1709809081557-78f803ce93a0", priceMajor: 38000, costMajor: 19500, description: "Wax-print wrap dress with a tie waist and flutter sleeves.", options: [{ name: "Size", values: ["S", "M", "L", "XL"] }], tags: ["bestseller"] },
      { key: "adire-two-piece", name: "Adire Two-Piece Set", categoryId: "cat_womenswear", categoryName: "Womenswear", unsplashPhotoId: "1663044023378-7316615967a0", priceMajor: 45000, costMajor: 23000, description: "Indigo adire crop top and wide-leg trousers, hand-dyed in Abeokuta.", options: [{ name: "Size", values: ["S", "M", "L"] }] },
      { key: "senator-kaftan", name: "Men's Senator Kaftan", categoryId: "cat_menswear", categoryName: "Menswear", unsplashPhotoId: "1782566208081-6b5135fddf23", priceMajor: 55000, costMajor: 29000, description: "Tailored senator kaftan with adire cuffs and placket.", options: [{ name: "Size", values: ["M", "L", "XL", "XXL"] }] },
      { key: "ankara-bomber", name: "Ankara Bomber Jacket", categoryId: "cat_menswear", categoryName: "Menswear", unsplashPhotoId: "1602794837437-89ab353d5b4a", priceMajor: 48000, costMajor: 26000, description: "Reversible Ankara bomber with ribbed cuffs.", options: [{ name: "Size", values: ["M", "L", "XL"] }] },
      { key: "aso-oke-gele", name: "Aso-Oke Gele Headtie", categoryId: "cat_accessories", categoryName: "Accessories", unsplashPhotoId: "1783038312854-f84ae9a0cc2f", priceMajor: 22000, costMajor: 9500, description: "Hand-woven aso-oke gele, pre-starched for easy tying.", options: [{ name: "Colour", values: ["Gold", "Wine", "Emerald"] }] },
      { key: "beaded-necklace", name: "Beaded Statement Necklace", categoryId: "cat_accessories", categoryName: "Accessories", unsplashPhotoId: "1629481995102-ff98d306dd8a", priceMajor: 18000, costMajor: 7000, description: "Coral-tone glass beads strung by hand in Bida." },
      { key: "adire-pillow-covers", name: "Adire Throw Pillow Covers (pair)", categoryId: "cat_textiles", categoryName: "Fabric & home textiles", unsplashPhotoId: "1553114552-c4ece3a33c93", priceMajor: 20000, costMajor: 8500, description: "Two 45cm cushion covers in eleko resist-dye patterns." },
      { key: "indigo-adire-fabric", name: "Hand-dyed Indigo Adire (2 yards)", categoryId: "cat_textiles", categoryName: "Fabric & home textiles", unsplashPhotoId: null, priceMajor: 15000, costMajor: 6000, description: "Two yards of cotton adire, tie-dyed with natural indigo.", tags: ["made-in-nigeria"] },
      { key: "adire-silk-scarf", name: "Adire Silk Scarf", categoryId: "cat_accessories", categoryName: "Accessories", unsplashPhotoId: null, priceMajor: 12500, costMajor: 5000, description: "Lightweight silk scarf with a batik border.", tags: ["made-in-nigeria"] },
    ],
    skuPrefix: "ADL",
    barcodeCompanyDigits: "6151",
    stockLocationIds: ["loc_adire_yaba", "loc_adire_abeokuta"],
    bulkStockLocationId: "loc_adire_abeokuta",
    highVolumeCategoryIds: [],
    brandTagsByProductKey: { "adire-two-piece": adireLabOwnBrandTag, "indigo-adire-fabric": adireLabOwnBrandTag, "adire-silk-scarf": adireLabOwnBrandTag, "adire-pillow-covers": adireLabOwnBrandTag },
  },
  customers: {
    rows: [
      ["Kemi Adekunle", "+2348031239901", "kemi.adekunle@gmail.com", "kemi.adekunle", ["vip"], 0],
      ["Amaka Chukwu", "+2348091239902", "amaka@amakachukwu.tv", "amakachukwu", ["creator"], 0],
      ["Olumide Johnson", "+2348021239903", null, "olumide.j", [], 0],
      ["Ifeoma Nwankwo", "+2348171239904", "ifeoma.reads@gmail.com", "ifeoma.reads", [], 0],
      ["Funke Adeoye", "+2348061239905", null, null, ["bridal"], 0],
      ["Tayo Martins", "+2348151239906", "tayo.martins@outlook.com", null, [], 0],
    ],
    firstCustomerNote: { body: "Ordered matching gele for her sister's wedding. Likes wine and gold.", authorStaffId: "stf_toyin_adire", authorName: "Toyin Afolabi" },
  },
  onlineOrders: {
    orderCount: 16,
    historyLengthInDays: 30,
    firstOrderNumber: 58410,
    buyers: [
      { id: "usr_kemi", name: "Kemi Adekunle", username: "kemi.adekunle", city: "Surulere", state: "Lagos" },
      { id: "usr_amaka", name: "Amaka Chukwu", username: "amakachukwu", city: "Lekki", state: "Lagos" },
      { id: "usr_ifeoma", name: "Ifeoma Nwankwo", username: "ifeoma.reads", city: "Enugu", state: "Enugu" },
      { id: "usr_aisha", name: "Aisha Mohammed", username: "aishamoh", city: "Ikoyi", state: "Lagos" },
      { id: "usr_olumide", name: "Olumide Johnson", username: "olumide.j", city: "Victoria Island", state: "Lagos" },
      { id: "usr_chinedu", name: "Chinedu Okeke", username: "chinedu.codes", city: "Wuse", state: "FCT" },
    ],
    creators: [{ id: "usr_cr1", username: "stylewithtemi" }],
    creatorShare: 0.25,
    fulfilmentLocationId: "loc_adire_yaba",
    disputedOrderIndex: null,
    disputeBuyerMessage: "",
    homeState: "Lagos",
    shippingFeeMinor: { homeState: 200_000, otherStates: 400_000 },
    returnReasons: ["Dress runs small", "Colour differs from photos"],
  },
  wallet: {
    payoutAccounts: [{ id: "pac_adire_zenith", bankName: "Zenith Bank", bankCode: "057", accountNameMasked: "ADIRE LA***DIO", accountNumberMasked: "******7730", isDefault: true, verified: true }],
    payoutAmountsMinor: [18_500_000, 22_750_000, 14_200_000],
    payoutFeeMinor: 5_000,
    payoutAccountSummary: "Zenith Bank ******7730",
    pendingMinor: 4_200_000,
    availableMinor: 21_640_000,
  },
  auditEntries: [
    ["stf_adaeze_adire", "staff.invited", "staff", "Invited Zainab Yusuf as sales staff", 12],
    ["stf_toyin_adire", "inventory.adjusted", "variant", "Received 20 × Hand-dyed Indigo Adire from Abeokuta dye workshop", 2],
    ["stf_toyin_adire", "order.shipped", "order", "Marked ZM-58418 as shipped with GIG Logistics", 4],
    ["stf_adaeze_adire", "settings.updated", "store", "Turned off loyalty points", 9],
  ],
};
