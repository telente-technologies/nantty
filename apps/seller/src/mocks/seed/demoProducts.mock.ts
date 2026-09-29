import type { Product, ProductVariant, StockLevel } from "@/types/catalog.type";
import { buildEan13FromTwelveDigits } from "@/utils/ean13.util";
import { buildIsoDateDaysAgo, createSeededRandomNumberGenerator, pickRandomIntegerInclusive } from "@/mocks/seed/seededRandom.mock";

interface DemoProductBlueprint {
  readonly key: string;
  readonly name: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly unsplashPhotoId: string | null;
  readonly priceNaira: number;
  readonly costNaira: number;
  readonly description: string;
  readonly options?: { readonly name: string; readonly values: string[] }[];
  readonly taxable?: boolean;
  readonly publishedOnline?: boolean;
  readonly tags?: string[];
}

const demoProductBlueprints: DemoProductBlueprint[] = [
  { key: "adire-shirt", name: "Adire Oxford Shirt", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1602810318383-e386cc2a3ccf", priceNaira: 18500, costNaira: 9800, description: "Hand-dyed adire panels on a breathable cotton oxford.", options: [{ name: "Size", values: ["S", "M", "L", "XL"] }, { name: "Colour", values: ["Indigo", "Wine"] }], tags: ["bestseller"] },
  { key: "crew-tee", name: "Everyday Crew Tee", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1618354691373-d851c5c3a990", priceNaira: 9500, costNaira: 4200, description: "Heavyweight 240gsm cotton tee with a small chest logo.", options: [{ name: "Size", values: ["S", "M", "L", "XL"] }, { name: "Colour", values: ["Black", "White"] }] },
  { key: "bomber", name: "Rust Bomber Jacket", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1591047139829-d91aecb6caea", priceNaira: 42000, costNaira: 23500, description: "Light satin bomber for harmattan evenings.", options: [{ name: "Size", values: ["M", "L", "XL"] }] },
  { key: "joggers", name: "Linen Joggers", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1594633312681-425c7b97ccd1", priceNaira: 21000, costNaira: 11000, description: "Relaxed linen joggers with a drawstring waist.", options: [{ name: "Size", values: ["S", "M", "L"] }] },
  { key: "trail-runner", name: "Trail Runner Sneakers", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1491553895911-0055eca6402d", priceNaira: 56000, costNaira: 34000, description: "Cushioned runners with a grippy outsole.", options: [{ name: "Size", values: ["41", "42", "43", "44", "45"] }] },
  { key: "street-sneakers", name: "Street Sneakers", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1560769629-975ec94e6a86", priceNaira: 48500, costNaira: 29000, description: "Chunky everyday sneakers in a pastel colourway.", options: [{ name: "Size", values: ["39", "40", "41", "42", "43"] }] },
  { key: "sunglasses", name: "Classic Sunglasses", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1572635196237-14b3f281503f", priceNaira: 15000, costNaira: 6500, description: "UV400 lenses in a timeless square frame." },
  { key: "top-handle", name: "Leather Top-Handle Bag", categoryId: "cat_bags", categoryName: "Bags", unsplashPhotoId: "1584917865442-de89df76afd3", priceNaira: 68000, costNaira: 39000, description: "Structured leather bag with a detachable strap.", options: [{ name: "Colour", values: ["Red", "Black"] }] },
  { key: "crossbody", name: "Tan Crossbody Bag", categoryId: "cat_bags", categoryName: "Bags", unsplashPhotoId: "1600857062241-98e5dba7f214", priceNaira: 38500, costNaira: 21000, description: "Soft tan crossbody that fits a phone, keys and a power bank." },
  { key: "backpack", name: "Everyday Laptop Backpack", categoryId: "cat_bags", categoryName: "Bags", unsplashPhotoId: "1553062407-98eeb64c6a62", priceNaira: 32000, costNaira: 17500, description: "Water-resistant backpack with a padded 15\" sleeve." },
  { key: "adire-tote", name: "Adire Canvas Tote", categoryId: "cat_bags", categoryName: "Bags", unsplashPhotoId: null, priceNaira: 7500, costNaira: 3100, description: "Sturdy canvas tote with an adire print.", tags: ["made-in-nigeria"] },
  { key: "pearl-necklace", name: "Pearl Strand Necklace", categoryId: "cat_jewellery", categoryName: "Jewellery", unsplashPhotoId: "1515562141207-7a88fb7ce338", priceNaira: 27500, costNaira: 12000, description: "Freshwater pearls on a silk thread." },
  { key: "pendant", name: "Gold Pendant Necklace", categoryId: "cat_jewellery", categoryName: "Jewellery", unsplashPhotoId: "1599643478518-a784e5dc4c8f", priceNaira: 34000, costNaira: 16000, description: "Gold-plated chain with a crescent pendant." },
  { key: "face-serum", name: "Glow Face Serum 30ml", categoryId: "cat_beauty", categoryName: "Beauty & care", unsplashPhotoId: "1608571423902-eed4a5ad8108", priceNaira: 12500, costNaira: 5200, description: "Vitamin C and niacinamide serum for an even glow.", tags: ["bestseller"] },
  { key: "body-oil", name: "Body Oil Trio", categoryId: "cat_beauty", categoryName: "Beauty & care", unsplashPhotoId: "1611930022073-b7a4ba5fcccd", priceNaira: 16000, costNaira: 7400, description: "Three body oils: baobab, marula and moringa." },
  { key: "shea-butter", name: "Raw Shea Butter 250g", categoryId: "cat_beauty", categoryName: "Beauty & care", unsplashPhotoId: null, priceNaira: 4500, costNaira: 1800, description: "Unrefined shea butter from Kwara.", tags: ["made-in-nigeria"] },
  { key: "black-soap", name: "Ose Dudu Black Soap", categoryId: "cat_beauty", categoryName: "Beauty & care", unsplashPhotoId: null, priceNaira: 2500, costNaira: 900, description: "Traditional black soap with cocoa pod ash.", tags: ["made-in-nigeria"] },
  { key: "headphones", name: "Wireless Over-Ear Headphones", categoryId: "cat_gadgets", categoryName: "Gadgets", unsplashPhotoId: "1505740420928-5e560c06d30e", priceNaira: 45000, costNaira: 28000, description: "40-hour battery, fold-flat design." },
  { key: "studio-headphones", name: "Studio Headphones", categoryId: "cat_gadgets", categoryName: "Gadgets", unsplashPhotoId: "1583394838336-acd977736f90", priceNaira: 38000, costNaira: 22500, description: "Wired monitoring headphones for creators." },
  { key: "earbuds", name: "Wireless Earbuds", categoryId: "cat_gadgets", categoryName: "Gadgets", unsplashPhotoId: "1606220588913-b3aacb4d2f46", priceNaira: 26500, costNaira: 14800, description: "Noise-reducing earbuds with a pocket case.", tags: ["bestseller"] },
  { key: "smartwatch", name: "Smartwatch Classic", categoryId: "cat_gadgets", categoryName: "Gadgets", unsplashPhotoId: "1523275335684-37898b6baf30", priceNaira: 52000, costNaira: 33000, description: "Heart rate, sleep and step tracking with a 7-day battery.", options: [{ name: "Colour", values: ["White", "Black"] }] },
  { key: "bottle", name: "Insulated Water Bottle 750ml", categoryId: "cat_home", categoryName: "Home", unsplashPhotoId: "1602143407151-7111542de6e8", priceNaira: 11000, costNaira: 5000, description: "Keeps drinks cold for 24 hours." },
  { key: "candle", name: "Scented Candle — Lagos Rain", categoryId: "cat_home", categoryName: "Home", unsplashPhotoId: "1603006905003-be475563bc59", priceNaira: 9000, costNaira: 3600, description: "Soy wax candle with notes of petrichor and lemongrass." },
  { key: "orange-juice", name: "Fresh Orange Juice 50cl", categoryId: "cat_food", categoryName: "Food & drinks", unsplashPhotoId: "1600271886742-f049cd451bba", priceNaira: 1800, costNaira: 850, description: "Cold-pressed daily. Keep refrigerated.", taxable: false, publishedOnline: false },
  { key: "zobo", name: "Zobo Drink 50cl", categoryId: "cat_food", categoryName: "Food & drinks", unsplashPhotoId: null, priceNaira: 1200, costNaira: 450, description: "Hibiscus drink with ginger and pineapple.", taxable: false, publishedOnline: false },
  { key: "plantain-chips", name: "Plantain Chips 150g", categoryId: "cat_food", categoryName: "Food & drinks", unsplashPhotoId: null, priceNaira: 1500, costNaira: 600, description: "Crunchy ripe plantain chips, lightly salted.", taxable: false },
  { key: "chin-chin", name: "Chin Chin 250g", categoryId: "cat_food", categoryName: "Food & drinks", unsplashPhotoId: null, priceNaira: 2000, costNaira: 800, description: "Crunchy nutmeg chin chin.", taxable: false },
  { key: "watermelon", name: "Watermelon (whole)", categoryId: "cat_food", categoryName: "Food & drinks", unsplashPhotoId: "1587049352846-4a222e784d38", priceNaira: 3500, costNaira: 2000, description: "Sweet watermelon from Kano farms.", taxable: false, publishedOnline: false },
];

const demoStockLocationIds = ["loc_lekki", "loc_ikeja", "loc_wuse", "loc_apapa"];

function buildUnsplashImageUrl(photoId: string): string {
  return `https://images.unsplash.com/photo-${photoId}?w=800&q=80&fm=webp`;
}

function listEveryOptionCombination(options: readonly { readonly name: string; readonly values: string[] }[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (combinations, option) => combinations.flatMap((combination) => option.values.map((value) => ({ ...combination, [option.name]: value }))),
    [{}],
  );
}

function buildDemoStockLevels(random: () => number, isLowStockVariant: boolean): StockLevel[] {
  return demoStockLocationIds.map((locationId) => ({
    locationId,
    onHand: isLowStockVariant && locationId === "loc_lekki" ? pickRandomIntegerInclusive(0, 3, random) : pickRandomIntegerInclusive(locationId === "loc_apapa" ? 20 : 4, locationId === "loc_apapa" ? 120 : 40, random),
    reserved: locationId === "loc_lekki" ? pickRandomIntegerInclusive(0, 2, random) : 0,
  }));
}

export function buildDemoProducts(): Product[] {
  const random = createSeededRandomNumberGenerator(20260929);
  return demoProductBlueprints.map((blueprint, productIndex) => {
    const productId = `prod_${blueprint.key.replace(/-/g, "_")}`;
    const options = blueprint.options ?? [];
    const combinations = listEveryOptionCombination(options);
    const variants = combinations.map((optionValues, variantIndex): ProductVariant => {
      const variantSuffix = Object.values(optionValues).map((value) => value.slice(0, 3).toUpperCase()).join("-");
      const barcodeBody = `6150${String(productIndex + 1).padStart(4, "0")}${String(variantIndex + 1).padStart(4, "0")}`;
      return {
        id: `var_${blueprint.key.replace(/-/g, "_")}_${variantIndex + 1}`,
        productId,
        title: Object.values(optionValues).join(" / ") || "Default",
        optionValues,
        sku: `IFE-${blueprint.categoryId.slice(4, 7).toUpperCase()}-${String(productIndex + 1).padStart(3, "0")}${variantSuffix ? `-${variantSuffix}` : ""}`,
        barcode: buildEan13FromTwelveDigits(barcodeBody),
        price: { amountMinor: blueprint.priceNaira * 100, currency: "NGN" },
        compareAtPrice: productIndex % 7 === 3 ? { amountMinor: Math.round(blueprint.priceNaira * 1.2) * 100, currency: "NGN" } : null,
        costPrice: { amountMinor: blueprint.costNaira * 100, currency: "NGN" },
        lowStockThreshold: blueprint.categoryId === "cat_food" ? 12 : 5,
        stock: buildDemoStockLevels(random, (productIndex + variantIndex) % 9 === 0),
      };
    });
    return {
      id: productId,
      name: blueprint.name,
      description: blueprint.description,
      categoryId: blueprint.categoryId,
      categoryName: blueprint.categoryName,
      status: "active",
      publishedOnline: blueprint.publishedOnline ?? true,
      images: blueprint.unsplashPhotoId ? [{ mediaId: `media_${blueprint.key.replace(/-/g, "_")}`, url: buildUnsplashImageUrl(blueprint.unsplashPhotoId) }] : [],
      options,
      variants,
      taxable: blueprint.taxable ?? true,
      trackInventory: true,
      tags: blueprint.tags ?? [],
      createdAt: buildIsoDateDaysAgo(120 - productIndex * 3),
      updatedAt: buildIsoDateDaysAgo(productIndex % 10),
    };
  });
}
