import { randomBytes, scryptSync } from "node:crypto";

import { demoMainStoreId } from "@/mocks/seed/demoStore.mock";
import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";
import type { StaffRole } from "@/types/sellerAccess.type";
import type { StaffMember } from "@/types/staff.type";

export const demoAccountPassword = "Zudomart2026!";

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

export interface MockStaffRecord extends StaffMember {
  readonly pinHash: string | null;
  readonly failedPinAttempts: number;
}

export function hashPosPinForStorage(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

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
  ];
}

export function buildDemoMemberships(): MockStoreMembership[] {
  return [
    { userId: "usr_adaeze", storeId: demoMainStoreId, role: "owner", staffId: "stf_adaeze" },
    { userId: "usr_tunde", storeId: demoMainStoreId, role: "manager", staffId: "stf_tunde" },
    { userId: "usr_blessing", storeId: demoMainStoreId, role: "cashier", staffId: "stf_blessing" },
    { userId: "usr_ibrahim", storeId: demoMainStoreId, role: "inventory", staffId: "stf_ibrahim" },
    { userId: "usr_ngozi", storeId: demoMainStoreId, role: "support", staffId: "stf_ngozi" },
    { userId: "usr_kelechi", storeId: "store_kelechi_kicks", role: "owner", staffId: "stf_kelechi" },
    { userId: "usr_funmi", storeId: "store_funmi_bakes", role: "owner", staffId: "stf_funmi" },
  ];
}

function buildStaffRecord(partial: Pick<StaffMember, "id" | "userId" | "name" | "email" | "phone" | "role" | "locationIds">, pin: string | null, lastActiveDaysAgo: number): MockStaffRecord {
  return {
    ...partial,
    status: "active",
    hasPosPin: pin !== null,
    pinHash: pin ? hashPosPinForStorage(pin) : null,
    failedPinAttempts: 0,
    pinLockedUntil: null,
    lastActiveAt: buildIsoDateDaysAgo(lastActiveDaysAgo, 9),
    invitedAt: buildIsoDateDaysAgo(200 - lastActiveDaysAgo * 10),
  };
}

export function buildDemoStaffRecords(): MockStaffRecord[] {
  const everyLocation = ["loc_lekki", "loc_ikeja", "loc_wuse", "loc_apapa"];
  return [
    buildStaffRecord({ id: "stf_adaeze", userId: "usr_adaeze", name: "Adaeze Okafor", email: "adaeze@ifelifestyle.ng", phone: "+2348035550142", role: "owner", locationIds: everyLocation }, "1111", 0),
    buildStaffRecord({ id: "stf_tunde", userId: "usr_tunde", name: "Tunde Bakare", email: "tunde@ifelifestyle.ng", phone: "+2348095550177", role: "manager", locationIds: ["loc_lekki", "loc_ikeja"] }, "2580", 0),
    buildStaffRecord({ id: "stf_blessing", userId: "usr_blessing", name: "Blessing Eze", email: "blessing@ifelifestyle.ng", phone: "+2348125550190", role: "cashier", locationIds: ["loc_lekki"] }, "1234", 0),
    buildStaffRecord({ id: "stf_chidi", userId: null, name: "Chidi Amadi", email: null, phone: "+2348105550133", role: "cashier", locationIds: ["loc_ikeja"] }, "4321", 1),
    buildStaffRecord({ id: "stf_amina", userId: null, name: "Amina Bello", email: "amina@ifelifestyle.ng", phone: null, role: "cashier", locationIds: ["loc_wuse"] }, "9876", 2),
    buildStaffRecord({ id: "stf_ibrahim", userId: "usr_ibrahim", name: "Ibrahim Musa", email: "ibrahim@ifelifestyle.ng", phone: "+2348025550111", role: "inventory", locationIds: ["loc_apapa", "loc_lekki"] }, null, 1),
    buildStaffRecord({ id: "stf_ngozi", userId: "usr_ngozi", name: "Ngozi Nwosu", email: "ngozi@ifelifestyle.ng", phone: "+2348065550123", role: "support", locationIds: everyLocation }, null, 3),
    { ...buildStaffRecord({ id: "stf_seun", userId: null, name: "Seun Alabi", email: "seun.alabi@gmail.com", phone: null, role: "cashier", locationIds: ["loc_lekki"] }, null, 0), status: "invited", lastActiveAt: null },
  ];
}
