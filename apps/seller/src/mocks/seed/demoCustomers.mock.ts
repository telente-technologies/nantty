import type { Customer } from "@/types/customer.type";
import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";

const demoCustomerRows: [string, string | null, string | null, string | null, string[], number][] = [
  ["Chioma Nnaji", "+2348031234501", "chioma.nnaji@gmail.com", "chioma.styles", ["vip"], 2450],
  ["Emeka Uzor", "+2348021234502", null, null, [], 320],
  ["Halima Yusuf", "+2348061234503", "halima.y@yahoo.com", "halimayusuf", ["wholesale"], 5100],
  ["Olumide Balogun", "+2348091234504", "olumide@balogunlaw.ng", null, ["corporate"], 880],
  ["Zainab Abdullahi", "+2348121234505", null, "zainab.a", [], 150],
  ["Femi Johnson", "+2348151234506", "femi.johnson@outlook.com", null, ["vip"], 3900],
  ["Ifeoma Chukwu", "+2348171234507", "ifeoma.c@gmail.com", "ifyskincare", [], 640],
  ["Babatunde Lawal", "+2348181234508", null, null, [], 0],
  ["Aisha Garba", "+2348031234509", "aisha.garba@gmail.com", null, ["abuja"], 1200],
  ["Kunle Afolabi", "+2348021234510", null, "kunle.afo", [], 410],
  ["Precious Okon", "+2348061234511", "precious.okon@gmail.com", null, [], 90],
  ["Tobi Ajayi", "+2348091234512", null, "tobi.ajayi", ["creator"], 1760],
];

export function buildDemoCustomers(): Customer[] {
  return demoCustomerRows.map(([name, phone, email, username, tags, loyaltyPoints], index) => ({
    id: `cus_${String(index + 1).padStart(3, "0")}`,
    name,
    phone,
    email,
    zudomartUsername: username,
    tags,
    notes: index === 0 ? [{ id: "note_1", body: "Prefers size M. Likes to be called when new adire shirts arrive.", author: { id: "stf_tunde", name: "Tunde Bakare" }, createdAt: buildIsoDateDaysAgo(20) }] : [],
    loyaltyPoints,
    totalSpent: { amountMinor: 0, currency: "NGN" },
    purchasesCount: 0,
    lastPurchaseAt: null,
    createdAt: buildIsoDateDaysAgo(150 - index * 9),
    marketingOptIn: index % 3 !== 1,
  }));
}
