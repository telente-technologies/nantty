import { demoMainStoreId } from "@/mocks/seed/demoStore.mock";
import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";
import type { StaffRole } from "@/types/sellerAccess.type";
import type { StaffMember } from "@/types/staff.type";

export const demoAccountPassword = "Nantty2026!";

export interface MockUserAccount {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly email: string;
  readonly phone: string;
  readonly avatarUrl: string | null;
}

export interface MockStoreMembership {
  readonly userId: string;
  readonly storeId: string;
  readonly role: StaffRole;
  readonly staffId: string;
}

export type MockStaffRecord = StaffMember;

export function buildDemoUserAccounts(): MockUserAccount[] {
  return [
    { id: "usr_adaeze", name: "Adaeze Okafor", username: "adaeze.okafor", email: "adaeze@ifelifestyle.ng", phone: "+2348035550142", avatarUrl: null },
    { id: "usr_tunde", name: "Tunde Bakare", username: "tunde.bakare", email: "tunde@ifelifestyle.ng", phone: "+2348095550177", avatarUrl: null },
    { id: "usr_blessing", name: "Blessing Eze", username: "blessing.eze", email: "blessing@ifelifestyle.ng", phone: "+2348125550190", avatarUrl: null },
    { id: "usr_ibrahim", name: "Ibrahim Musa", username: "ibrahim.musa", email: "ibrahim@ifelifestyle.ng", phone: "+2348025550111", avatarUrl: null },
    { id: "usr_ngozi", name: "Ngozi Nwosu", username: "ngozi.nwosu", email: "ngozi@ifelifestyle.ng", phone: "+2348065550123", avatarUrl: null },
    { id: "usr_kelechi", name: "Kelechi Obi", username: "kelechi.kicks", email: "kelechi@kelechikicks.ng", phone: "+2348075550155", avatarUrl: null },
    { id: "usr_funmi", name: "Funmilayo Adeyemi", username: "funmibakes", email: "funmi@funmibakes.ng", phone: "+2348145550166", avatarUrl: null },
    { id: "usr_dayo", name: "Dayo Ogunleye", username: "dayo.ogunleye", email: "dayo@gmail.com", phone: "+2348185550199", avatarUrl: null },
    { id: "usr_chidi", name: "Chidi Amadi", username: "chidi.amadi", email: "chidi.amadi@example.com", phone: "+2348105550133", avatarUrl: null },
    { id: "usr_amina", name: "Amina Bello", username: "amina.bello", email: "amina.bello@example.com", phone: "+2348105550144", avatarUrl: null },
    { id: "usr_seun", name: "Seun Alabi", username: "seun.alabi", email: "seun.alabi@example.com", phone: "+2348105550155", avatarUrl: null },
    { id: "usr_zainab", name: "Zainab Yusuf", username: "zainab.yusuf", email: "zainab.yusuf@example.com", phone: "+2348105550166", avatarUrl: null },
    { id: "usr_emeka", name: "Emeka Nnaji", username: "emeka.sells", email: "emeka.nnaji@example.com", phone: "+2348105550177", avatarUrl: null },
    { id: "usr_toyin", name: "Toyin Afolabi", username: "toyin.afolabi", email: "toyin.afolabi@example.com", phone: "+2348105550188", avatarUrl: null },
    { id: "usr_ifeoma", name: "Ifeoma Nwankwo", username: "ifeoma.reads", email: "ifeoma.reads@example.com", phone: "+2348105550199", avatarUrl: null },
  ];
}

export function buildDemoMemberships(): MockStoreMembership[] {
  return [
    { userId: "usr_adaeze", storeId: demoMainStoreId, role: "owner", staffId: "stf_adaeze" },
    { userId: "usr_tunde", storeId: demoMainStoreId, role: "manager", staffId: "stf_tunde" },
    { userId: "usr_adaeze", storeId: "store_adire_lab_studio", role: "owner", staffId: "stf_adaeze_adire" },
    { userId: "usr_blessing", storeId: demoMainStoreId, role: "sales", staffId: "stf_blessing" },
    { userId: "usr_ibrahim", storeId: demoMainStoreId, role: "inventory", staffId: "stf_ibrahim" },
    { userId: "usr_ngozi", storeId: demoMainStoreId, role: "sales", staffId: "stf_ngozi" },
    { userId: "usr_amina", storeId: demoMainStoreId, role: "accountant", staffId: "stf_amina" },
    { userId: "usr_kelechi", storeId: "store_kelechi_kicks", role: "owner", staffId: "stf_kelechi" },
    { userId: "usr_funmi", storeId: "store_funmi_bakes", role: "owner", staffId: "stf_funmi" },
  ];
}

export function buildDemoStaffRecord(partial: Pick<StaffMember, "id" | "userId" | "name" | "username" | "role" | "locationIds">, lastActiveDaysAgo: number): MockStaffRecord {
  return {
    ...partial,
    avatarUrl: null,
    status: "active",
    permissions: null,
    lastActiveAt: buildIsoDateDaysAgo(lastActiveDaysAgo, 9),
    invitedAt: buildIsoDateDaysAgo(200 - lastActiveDaysAgo * 10),
  };
}

export function buildIfeLifestyleStaffRecords(): MockStaffRecord[] {
  const everyLocation = ["loc_lekki", "loc_ikeja", "loc_wuse", "loc_apapa"];
  return [
    buildDemoStaffRecord({ id: "stf_adaeze", userId: "usr_adaeze", name: "Adaeze Okafor", username: "adaeze.okafor", role: "owner", locationIds: everyLocation }, 0),
    buildDemoStaffRecord({ id: "stf_tunde", userId: "usr_tunde", name: "Tunde Bakare", username: "tunde.bakare", role: "manager", locationIds: ["loc_lekki", "loc_ikeja"] }, 0),
    buildDemoStaffRecord({ id: "stf_blessing", userId: "usr_blessing", name: "Blessing Eze", username: "blessing.eze", role: "sales", locationIds: ["loc_lekki"] }, 0),
    buildDemoStaffRecord({ id: "stf_chidi", userId: "usr_chidi", name: "Chidi Amadi", username: "chidi.amadi", role: "sales", locationIds: ["loc_ikeja"] }, 1),
    buildDemoStaffRecord({ id: "stf_amina", userId: "usr_amina", name: "Amina Bello", username: "amina.bello", role: "accountant", locationIds: ["loc_wuse"] }, 2),
    buildDemoStaffRecord({ id: "stf_ibrahim", userId: "usr_ibrahim", name: "Ibrahim Musa", username: "ibrahim.musa", role: "inventory", locationIds: ["loc_apapa", "loc_lekki"] }, 1),
    { ...buildDemoStaffRecord({ id: "stf_ngozi", userId: "usr_ngozi", name: "Ngozi Nwosu", username: "ngozi.nwosu", role: "sales", locationIds: everyLocation }, 3), permissions: ["dashboard:view", "catalog:view", "settings:view", "orders:view", "orders:manage", "delivery:manage", "customers:view", "customers:manage", "messages:manage", "reviews:manage", "analytics:view", "promotions:manage"] },
    { ...buildDemoStaffRecord({ id: "stf_seun", userId: "usr_seun", name: "Seun Alabi", username: "seun.alabi", role: "sales", locationIds: ["loc_lekki"] }, 0), status: "invited", lastActiveAt: null },
  ];
}
