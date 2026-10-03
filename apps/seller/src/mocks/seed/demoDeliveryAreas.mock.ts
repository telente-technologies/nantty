import type { CurrencyCode } from "@/types/money.type";
import type { DeliveryArea } from "@/types/delivery.type";

export function buildDemoDeliveryAreas(homeState: string, currency: CurrencyCode): DeliveryArea[] {
  const toMoney = (amountMinor: number) => ({ amountMinor, currency });
  const areas: DeliveryArea[] = [
    { id: "zone_home", name: `${homeState} (same day / next day)`, state: homeState, cities: homeState === "Lagos" ? ["Ikeja", "Lekki", "Yaba", "Surulere", "Ajah", "Ikorodu"] : [homeState], fee: toMoney(250_000), estimatedDaysMin: 1, estimatedDaysMax: 2, active: true },
    { id: "zone_southwest", name: "South West", state: "Oyo", cities: ["Ibadan", "Abeokuta", "Akure", "Osogbo", "Ado-Ekiti"], fee: toMoney(350_000), estimatedDaysMin: 2, estimatedDaysMax: 3, active: true },
    { id: "zone_fct", name: "Abuja (FCT)", state: "FCT", cities: ["Wuse", "Garki", "Maitama", "Gwarinpa", "Kubwa"], fee: toMoney(400_000), estimatedDaysMin: 2, estimatedDaysMax: 4, active: true },
    { id: "zone_southsouth", name: "South South", state: "Rivers", cities: ["Port Harcourt", "Uyo", "Calabar", "Benin City", "Asaba"], fee: toMoney(450_000), estimatedDaysMin: 3, estimatedDaysMax: 5, active: true },
    { id: "zone_southeast", name: "South East", state: "Enugu", cities: ["Enugu", "Onitsha", "Owerri", "Aba", "Awka"], fee: toMoney(450_000), estimatedDaysMin: 3, estimatedDaysMax: 5, active: true },
    { id: "zone_north", name: "North", state: "Kano", cities: ["Kano", "Kaduna", "Jos", "Maiduguri", "Sokoto"], fee: toMoney(550_000), estimatedDaysMin: 4, estimatedDaysMax: 7, active: false },
  ];
  return areas.filter((area, index) => index === 0 || area.state !== homeState);
}
