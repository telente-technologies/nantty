import type { Supplier } from "@/types/catalog.type";
import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";

type DemoSupplierRow = readonly [name: string, contactName: string, phone: string, email: string | null, address: string, leadTimeDays: number, paymentTerms: string];

const demoSupplierRowsByStoreId: Record<string, readonly DemoSupplierRow[]> = {
  store_ife_lifestyle: [
    ["Balogun Textiles Ltd", "Mrs. Folake Adebayo", "+2348031234501", "orders@balogun-textiles.ng", "14 Balogun Street, Lagos Island, Lagos", 5, "50% upfront, balance on delivery"],
    ["Aba Leatherworks Cooperative", "Chinedu Okeke", "+2348062234502", "sales@abaleather.ng", "Ariaria International Market, Aba, Abia", 9, "Pay on delivery"],
    ["Kano Shea Collective", "Hajiya Maryam Sani", "+2348093234503", null, "Kurmi Market, Kano", 12, "Net 14 days"],
    ["GadgetHub Distribution", "Tobi Lawal", "+2348124234504", "trade@gadgethub.ng", "Computer Village, Ikeja, Lagos", 3, "Net 7 days"],
  ],
  store_adire_lab_studio: [
    ["Abeokuta Adire Dyers", "Mama Bisi Ogunleye", "+2348035234511", null, "Itoku Market, Abeokuta, Ogun", 7, "Pay on delivery"],
    ["Yaba Fabric House", "Kunle Ojo", "+2348056234512", "kunle@yabafabric.ng", "Tejuosho Market, Yaba, Lagos", 4, "50% upfront"],
    ["Ilorin Aso-Oke Weavers", "Abdulrahman Bello", "+2348077234513", null, "Oja Oba, Ilorin, Kwara", 14, "Net 14 days"],
    ["Lagos Packaging Co.", "Grace Etim", "+2348098234514", "grace@lagospack.ng", "Oregun Industrial Estate, Ikeja", 3, "Net 30 days"],
  ],
  store_kelechi_kicks: [
    ["Aba Shoe Makers Association", "Ikenna Nwosu", "+2348031234521", "ikenna@abashoes.ng", "Bakassi Shoe Plaza, Aba, Abia", 10, "Pay on delivery"],
    ["Onitsha Sneaker Wholesale", "Obinna Eze", "+2348062234522", null, "Main Market, Onitsha, Anambra", 6, "50% upfront"],
    ["SoleCare Supplies", "Ada Umeh", "+2348093234523", "hello@solecare.ng", "Wuse Market, Abuja", 5, "Net 7 days"],
    ["Port Harcourt Box Depot", "Tamuno Briggs", "+2348124234524", null, "Mile 1 Market, Port Harcourt", 4, "Pay on delivery"],
  ],
  store_funmi_bakes: [
    ["Mile 12 Flour Mills Depot", "Alhaji Musa Garba", "+2348031234531", null, "Mile 12 Market, Lagos", 2, "Pay on delivery"],
    ["Ikorodu Eggs & Poultry", "Mrs. Ronke Shittu", "+2348062234532", "ronke@ikorodueggs.ng", "Ikorodu, Lagos", 1, "Net 7 days"],
    ["Sweet Supplies Nigeria", "Damilola Ajayi", "+2348093234533", "orders@sweetsupplies.ng", "Surulere, Lagos", 3, "Net 14 days"],
    ["CakeBox Packaging", "Uche Obi", "+2348124234534", null, "Idumota, Lagos Island", 4, "50% upfront"],
  ],
};

export function buildDemoSuppliersForStore(storeId: string, productCountBySupplierId: ReadonlyMap<string, number>): Supplier[] {
  const rows = demoSupplierRowsByStoreId[storeId] ?? demoSupplierRowsByStoreId.store_ife_lifestyle ?? [];
  return rows.map(([name, contactName, phone, email, address, leadTimeDays, paymentTerms], index) => {
    const id = `sup_${index + 1}`;
    return { id, name, contactName, phone, email, address, leadTimeDays, paymentTerms, notes: null, productCount: productCountBySupplierId.get(id) ?? 0, createdAt: buildIsoDateDaysAgo(200 - index * 20) };
  });
}
