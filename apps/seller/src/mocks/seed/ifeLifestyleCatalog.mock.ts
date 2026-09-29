import type { ProductBrandTag } from "@/types/brand.type";
import type { DemoProductBlueprint } from "@/mocks/seed/demoStoreProfile.mock";

export const ifeLifestyleProductBlueprints: DemoProductBlueprint[] = [
  { key: "adire-shirt", name: "Adire Oxford Shirt", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1602810318383-e386cc2a3ccf", priceMajor: 18500, costMajor: 9800, description: "Hand-dyed adire panels on a breathable cotton oxford.", options: [{ name: "Size", values: ["S", "M", "L", "XL"] }, { name: "Colour", values: ["Indigo", "Wine"] }], tags: ["bestseller"] },
  { key: "crew-tee", name: "Everyday Crew Tee", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1618354691373-d851c5c3a990", priceMajor: 9500, costMajor: 4200, description: "Heavyweight 240gsm cotton tee with a small chest logo.", options: [{ name: "Size", values: ["S", "M", "L", "XL"] }, { name: "Colour", values: ["Black", "White"] }] },
  { key: "bomber", name: "Rust Bomber Jacket", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1591047139829-d91aecb6caea", priceMajor: 42000, costMajor: 23500, description: "Light satin bomber for harmattan evenings.", options: [{ name: "Size", values: ["M", "L", "XL"] }] },
  { key: "joggers", name: "Linen Joggers", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1594633312681-425c7b97ccd1", priceMajor: 21000, costMajor: 11000, description: "Relaxed linen joggers with a drawstring waist.", options: [{ name: "Size", values: ["S", "M", "L"] }] },
  { key: "trail-runner", name: "Trail Runner Sneakers", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1491553895911-0055eca6402d", priceMajor: 56000, costMajor: 34000, description: "Cushioned runners with a grippy outsole.", options: [{ name: "Size", values: ["41", "42", "43", "44", "45"] }] },
  { key: "street-sneakers", name: "Street Sneakers", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1560769629-975ec94e6a86", priceMajor: 48500, costMajor: 29000, description: "Chunky everyday sneakers in a pastel colourway.", options: [{ name: "Size", values: ["39", "40", "41", "42", "43"] }] },
  { key: "sunglasses", name: "Classic Sunglasses", categoryId: "cat_fashion", categoryName: "Fashion", unsplashPhotoId: "1572635196237-14b3f281503f", priceMajor: 15000, costMajor: 6500, description: "UV400 lenses in a timeless square frame." },
  { key: "top-handle", name: "Leather Top-Handle Bag", categoryId: "cat_bags", categoryName: "Bags", unsplashPhotoId: "1584917865442-de89df76afd3", priceMajor: 68000, costMajor: 39000, description: "Structured leather bag with a detachable strap.", options: [{ name: "Colour", values: ["Red", "Black"] }] },
  { key: "crossbody", name: "Tan Crossbody Bag", categoryId: "cat_bags", categoryName: "Bags", unsplashPhotoId: "1600857062241-98e5dba7f214", priceMajor: 38500, costMajor: 21000, description: "Soft tan crossbody that fits a phone, keys and a power bank." },
  { key: "backpack", name: "Everyday Laptop Backpack", categoryId: "cat_bags", categoryName: "Bags", unsplashPhotoId: "1553062407-98eeb64c6a62", priceMajor: 32000, costMajor: 17500, description: "Water-resistant backpack with a padded 15\" sleeve." },
  { key: "adire-tote", name: "Adire Canvas Tote", categoryId: "cat_bags", categoryName: "Bags", unsplashPhotoId: null, priceMajor: 7500, costMajor: 3100, description: "Sturdy canvas tote with an adire print.", tags: ["made-in-nigeria"] },
  { key: "pearl-necklace", name: "Pearl Strand Necklace", categoryId: "cat_jewellery", categoryName: "Jewellery", unsplashPhotoId: "1515562141207-7a88fb7ce338", priceMajor: 27500, costMajor: 12000, description: "Freshwater pearls on a silk thread." },
  { key: "pendant", name: "Gold Pendant Necklace", categoryId: "cat_jewellery", categoryName: "Jewellery", unsplashPhotoId: "1599643478518-a784e5dc4c8f", priceMajor: 34000, costMajor: 16000, description: "Gold-plated chain with a crescent pendant." },
  { key: "face-serum", name: "Glow Face Serum 30ml", categoryId: "cat_beauty", categoryName: "Beauty & care", unsplashPhotoId: "1608571423902-eed4a5ad8108", priceMajor: 12500, costMajor: 5200, description: "Vitamin C and niacinamide serum for an even glow.", tags: ["bestseller"] },
  { key: "body-oil", name: "Body Oil Trio", categoryId: "cat_beauty", categoryName: "Beauty & care", unsplashPhotoId: "1611930022073-b7a4ba5fcccd", priceMajor: 16000, costMajor: 7400, description: "Three body oils: baobab, marula and moringa." },
  { key: "shea-butter", name: "Raw Shea Butter 250g", categoryId: "cat_beauty", categoryName: "Beauty & care", unsplashPhotoId: null, priceMajor: 4500, costMajor: 1800, description: "Unrefined shea butter from Kwara.", tags: ["made-in-nigeria"] },
  { key: "black-soap", name: "Ose Dudu Black Soap", categoryId: "cat_beauty", categoryName: "Beauty & care", unsplashPhotoId: null, priceMajor: 2500, costMajor: 900, description: "Traditional black soap with cocoa pod ash.", tags: ["made-in-nigeria"] },
  { key: "headphones", name: "Wireless Over-Ear Headphones", categoryId: "cat_gadgets", categoryName: "Gadgets", unsplashPhotoId: "1505740420928-5e560c06d30e", priceMajor: 45000, costMajor: 28000, description: "40-hour battery, fold-flat design." },
  { key: "studio-headphones", name: "Studio Headphones", categoryId: "cat_gadgets", categoryName: "Gadgets", unsplashPhotoId: "1583394838336-acd977736f90", priceMajor: 38000, costMajor: 22500, description: "Wired monitoring headphones for creators." },
  { key: "earbuds", name: "Wireless Earbuds", categoryId: "cat_gadgets", categoryName: "Gadgets", unsplashPhotoId: "1606220588913-b3aacb4d2f46", priceMajor: 26500, costMajor: 14800, description: "Noise-reducing earbuds with a pocket case.", tags: ["bestseller"] },
  { key: "smartwatch", name: "Smartwatch Classic", categoryId: "cat_gadgets", categoryName: "Gadgets", unsplashPhotoId: "1523275335684-37898b6baf30", priceMajor: 52000, costMajor: 33000, description: "Heart rate, sleep and step tracking with a 7-day battery.", options: [{ name: "Colour", values: ["White", "Black"] }] },
  { key: "bottle", name: "Insulated Water Bottle 750ml", categoryId: "cat_home", categoryName: "Home", unsplashPhotoId: "1602143407151-7111542de6e8", priceMajor: 11000, costMajor: 5000, description: "Keeps drinks cold for 24 hours." },
  { key: "candle", name: "Scented Candle — Lagos Rain", categoryId: "cat_home", categoryName: "Home", unsplashPhotoId: "1603006905003-be475563bc59", priceMajor: 9000, costMajor: 3600, description: "Soy wax candle with notes of petrichor and lemongrass." },
  { key: "orange-juice", name: "Fresh Orange Juice 50cl", categoryId: "cat_food", categoryName: "Food & drinks", unsplashPhotoId: "1600271886742-f049cd451bba", priceMajor: 1800, costMajor: 850, description: "Cold-pressed daily. Keep refrigerated.", taxable: false, publishedOnline: false },
  { key: "zobo", name: "Zobo Drink 50cl", categoryId: "cat_food", categoryName: "Food & drinks", unsplashPhotoId: null, priceMajor: 1200, costMajor: 450, description: "Hibiscus drink with ginger and pineapple.", taxable: false, publishedOnline: false },
  { key: "plantain-chips", name: "Plantain Chips 150g", categoryId: "cat_food", categoryName: "Food & drinks", unsplashPhotoId: null, priceMajor: 1500, costMajor: 600, description: "Crunchy ripe plantain chips, lightly salted.", taxable: false },
  { key: "chin-chin", name: "Chin Chin 250g", categoryId: "cat_food", categoryName: "Food & drinks", unsplashPhotoId: null, priceMajor: 2000, costMajor: 800, description: "Crunchy nutmeg chin chin.", taxable: false },
  { key: "watermelon", name: "Watermelon (whole)", categoryId: "cat_food", categoryName: "Food & drinks", unsplashPhotoId: "1587049352846-4a222e784d38", priceMajor: 3500, costMajor: 2000, description: "Sweet watermelon from Kano farms.", taxable: false, publishedOnline: false },
];

const ifeLifestyleOwnBrandTag: ProductBrandTag = { brandId: "brand_ife_lifestyle", name: "Ìfẹ́ Lifestyle", relationship: "own" };
export const ifeLifestyleBrandTagsByProductKey: Record<string, ProductBrandTag> = {
  "adire-shirt": ifeLifestyleOwnBrandTag,
  "crew-tee": ifeLifestyleOwnBrandTag,
  "adire-tote": ifeLifestyleOwnBrandTag,
  candle: ifeLifestyleOwnBrandTag,
  earbuds: { brandId: "brand_oja_tech", name: "Ọjà Tech", relationship: "authorised_reseller" },
  "headphones": { brandId: "brand_oja_tech", name: "Ọjà Tech", relationship: "authorised_reseller" },
  "crossbody": { brandId: "brand_kano_leather", name: "Kano Leatherworks", relationship: "genuine_resale" },
  "face-serum": { brandId: "brand_lekki_glow", name: "Lekki Glow Cosmetics", relationship: "authorised_reseller" },
};
