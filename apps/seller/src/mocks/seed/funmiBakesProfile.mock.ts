import { buildDemoStaffRecord } from "@/mocks/seed/demoPeople.mock";
import { buildDemoStoreSettingsFromBasics } from "@/mocks/seed/demoStoreSettings.mock";
import type { DemoStoreProfile } from "@/mocks/seed/demoStoreProfile.mock";
import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";

const funmiBakesStoreId = "store_funmi_bakes";

export const funmiBakesStoreProfile: DemoStoreProfile = {
  storeId: funmiBakesStoreId,
  recordKey: "funmi",
  receiptPrefix: "FB",
  randomSeeds: { products: 7_072_026, onlineOrders: 1031 },
  buildSettings: () =>
    buildDemoStoreSettingsFromBasics({
      storeId: funmiBakesStoreId,
      name: "Funmi Bakes",
      handle: "funmibakes",
      description: "Small-batch cakes, chin chin and small chops baked fresh every morning in Surulere.",
      country: "NG",
      currency: "NGN",
      timezone: "Africa/Lagos",
      locale: "en-NG",
      phone: "+234 814 555 0166",
      email: "hello@funmibakes.ng",
      address: "7 Adelabu Street, Surulere, Lagos",
      taxes: [{ id: "tax_vat", name: "VAT", rateBasisPoints: 750, isDefault: true, appliesToCategoryIds: ["cat_gifts"] }],
      returnPolicy: "Food items cannot be returned. Tell us within 24 hours if anything is wrong with your order.",
      shippingPolicy: "Cakes are delivered within Lagos only, on the date you choose at checkout.",
    }),
  buildLocations: () => [
    { id: "loc_funmi_surulere", name: "Surulere bakery", kind: "store", address: "7 Adelabu Street", city: "Surulere", state: "Lagos", country: "NG", phone: "+234 814 555 0166", isDefault: true, active: true },
    { id: "loc_funmi_kitchen", name: "Central kitchen", kind: "warehouse", address: "3 Ogunlana Drive", city: "Surulere", state: "Lagos", country: "NG", phone: null, isDefault: false, active: true },
  ],
  buildCategories: () => [
    { id: "cat_cakes", name: "Cakes & bakes" },
    { id: "cat_snacks", name: "Snacks & small chops" },
    { id: "cat_pantry", name: "Pantry" },
    { id: "cat_gifts", name: "Gifts" },
  ],
  buildStaff: () => [
    buildDemoStaffRecord({ id: "stf_funmi", userId: "usr_funmi", name: "Funmilayo Adeyemi", username: "funmibakes", role: "owner", locationIds: ["loc_funmi_surulere", "loc_funmi_kitchen"] }, 0),
    buildDemoStaffRecord({ id: "stf_ifeoma_funmi", userId: "usr_ifeoma", name: "Ifeoma Nwankwo", username: "ifeoma.reads", role: "sales", locationIds: ["loc_funmi_surulere"] }, 0),
  ],
  buildPromotions: (currency) => [
    { id: "promo_funmi_saturday", name: "Sweet Saturday", kind: "automatic", code: null, discount: { kind: "amount", value: 50_000 }, scope: { kind: "categories", ids: ["cat_snacks"] }, minimumSpend: { amountMinor: 500_000, currency }, usageLimit: null, usageLimitPerCustomer: null, usedCount: 23, startsAt: buildIsoDateDaysAgo(30), endsAt: null, status: "active", createdAt: buildIsoDateDaysAgo(31) },
  ],
  catalog: {
    blueprints: [
      { key: "celebration-cake", name: "Celebration Cake 8\"", categoryId: "cat_cakes", categoryName: "Cakes & bakes", unsplashPhotoId: null, priceMajor: 35000, costMajor: 15000, description: "Two-layer sponge with buttercream. Order 48 hours ahead.", options: [{ name: "Flavour", values: ["Vanilla", "Red velvet", "Chocolate"] }], taxable: false, tags: ["bestseller"] },
      { key: "banana-bread", name: "Banana Bread Loaf", categoryId: "cat_cakes", categoryName: "Cakes & bakes", unsplashPhotoId: null, priceMajor: 5500, costMajor: 2200, description: "Moist banana bread with toasted groundnuts.", taxable: false },
      { key: "meat-pie-box", name: "Meat Pie (box of 6)", categoryId: "cat_snacks", categoryName: "Snacks & small chops", unsplashPhotoId: null, priceMajor: 6000, costMajor: 2800, description: "Buttery shortcrust pies with minced beef and potato.", taxable: false, publishedOnline: false },
      { key: "puff-puff-pack", name: "Puff-Puff (pack of 20)", categoryId: "cat_snacks", categoryName: "Snacks & small chops", unsplashPhotoId: null, priceMajor: 3000, costMajor: 1100, description: "Fresh puff-puff, fried every morning.", taxable: false, publishedOnline: false },
      { key: "chin-chin-jar", name: "Crunchy Chin Chin Jar", categoryId: "cat_snacks", categoryName: "Snacks & small chops", unsplashPhotoId: "1761984336685-95ceb1d581a7", priceMajor: 3500, costMajor: 1400, description: "Nutmeg chin chin in a resealable 500g jar.", taxable: false, tags: ["bestseller"] },
      { key: "plantain-chips-party", name: "Plantain Chips Party Pack", categoryId: "cat_snacks", categoryName: "Snacks & small chops", unsplashPhotoId: "1762884601729-0eeeafbdfb8a", priceMajor: 6000, costMajor: 2600, description: "Ten 50g packs of ripe and unripe plantain chips.", taxable: false },
      { key: "forest-honey", name: "Raw Forest Honey 500g", categoryId: "cat_pantry", categoryName: "Pantry", unsplashPhotoId: "1587049352851-8d4e89133924", priceMajor: 7500, costMajor: 4200, description: "Unfiltered honey from Oyo forest farmers.", taxable: false },
      { key: "zobo-leaves", name: "Dried Hibiscus (Zobo) Leaves", categoryId: "cat_pantry", categoryName: "Pantry", unsplashPhotoId: "1765118527329-6ed7fa0d10ac", priceMajor: 2500, costMajor: 900, description: "Sun-dried zobo leaves for home brewing.", taxable: false },
      { key: "stoneware-mug-set", name: "Stoneware Coffee Mug Set", categoryId: "cat_gifts", categoryName: "Gifts", unsplashPhotoId: "1590422749897-47036da0b0ff", priceMajor: 22000, costMajor: 12000, description: "Four speckled stoneware mugs — pairs well with a cake." },
    ],
    skuPrefix: "FB",
    barcodeCompanyDigits: "6153",
    stockLocationIds: ["loc_funmi_surulere", "loc_funmi_kitchen"],
    bulkStockLocationId: "loc_funmi_kitchen",
    highVolumeCategoryIds: ["cat_snacks", "cat_pantry"],
    brandTagsByProductKey: {},
  },
  customers: {
    rows: [
      ["Bisola Ogunleye", "+2348031235501", "bisola@bisolaeats.ng", "bisola.eats", ["creator"]],
      ["Kemi Adekunle", "+2348031235502", "kemi.adekunle@gmail.com", "kemi.adekunle", []],
      ["Mrs. Adeola Bankole", "+2348061235503", null, null, ["corporate"]],
      ["Tunji Oyelaran", "+2348091235504", null, null, []],
      ["Grace Umoh", "+2348121235505", "grace.umoh@yahoo.com", null, ["birthday-club"]],
    ],
    firstCustomerNote: { body: "Orders a red velvet cake for her office every last Friday.", authorStaffId: "stf_funmi", authorName: "Funmilayo Adeyemi" },
  },
  onlineOrders: {
    orderCount: 12,
    historyLengthInDays: 30,
    firstOrderNumber: 58630,
    buyers: [
      { id: "usr_bisola", name: "Bisola Ogunleye", username: "bisola.eats", city: "Surulere", state: "Lagos" },
      { id: "usr_kemi", name: "Kemi Adekunle", username: "kemi.adekunle", city: "Surulere", state: "Lagos" },
      { id: "usr_aisha", name: "Aisha Mohammed", username: "aishamoh", city: "Ikoyi", state: "Lagos" },
      { id: "usr_olumide", name: "Olumide Johnson", username: "olumide.j", city: "Victoria Island", state: "Lagos" },
    ],
    creators: [{ id: "usr_cr4", username: "lagosfoodie" }],
    creatorShare: 0.2,
    fulfilmentLocationId: "loc_funmi_kitchen",
    disputedOrderIndex: null,
    disputeBuyerMessage: "",
    homeState: "Lagos",
    shippingFeeMinor: { homeState: 150_000, otherStates: 300_000 },
    returnReasons: ["Jar lid was cracked on arrival"],
  },
  wallet: {
    payoutAccounts: [{ id: "pac_funmi_moniepoint", bankName: "Moniepoint MFB", bankCode: "50515", accountNameMasked: "FUNMI B***ES", accountNumberMasked: "******8841", isDefault: true, verified: true }],
    payoutAmountsMinor: [6_400_000, 5_150_000],
    payoutFeeMinor: 5_000,
    payoutAccountSummary: "Moniepoint ******8841",
    pendingMinor: 850_000,
    availableMinor: 3_975_000,
  },
  auditEntries: [
    ["stf_funmi", "staff.invited", "staff", "Invited Ifeoma Nwankwo as sales staff", 25],
    ["stf_funmi", "inventory.adjusted", "variant", "Baked 40 × Banana Bread Loaf at Central kitchen", 0],
  ],
};
