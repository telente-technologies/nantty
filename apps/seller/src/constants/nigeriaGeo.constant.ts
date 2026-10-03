export interface NigeriaGeoState {
  readonly code: string;
  readonly name: string;
  readonly localGovernmentAreas: readonly string[];
}

export const nigeriaCountry = { code: "NG", name: "Nigeria" } as const;

const noLocalGovernmentAreasYet: readonly string[] = [];

export const nigeriaGeoStates: readonly NigeriaGeoState[] = [
  { code: "AB", name: "Abia", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "AD", name: "Adamawa", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "AK", name: "Akwa Ibom", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "AN", name: "Anambra", localGovernmentAreas: ["Aguata", "Anambra East", "Anambra West", "Anaocha", "Awka North", "Awka South", "Ayamelum", "Dunukofia", "Ekwusigo", "Idemili North", "Idemili South", "Ihiala", "Njikoka", "Nnewi North", "Nnewi South", "Ogbaru", "Onitsha North", "Onitsha South", "Orumba North", "Orumba South", "Oyi"] },
  { code: "BA", name: "Bauchi", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "BY", name: "Bayelsa", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "BE", name: "Benue", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "BO", name: "Borno", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "CR", name: "Cross River", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "DE", name: "Delta", localGovernmentAreas: ["Aniocha North", "Aniocha South", "Bomadi", "Burutu", "Ethiope East", "Ethiope West", "Ika North East", "Ika South", "Isoko North", "Isoko South", "Ndokwa East", "Ndokwa West", "Okpe", "Oshimili North", "Oshimili South", "Patani", "Sapele", "Udu", "Ughelli North", "Ughelli South", "Ukwuani", "Uvwie", "Warri North", "Warri South", "Warri South West"] },
  { code: "EB", name: "Ebonyi", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "ED", name: "Edo", localGovernmentAreas: ["Akoko-Edo", "Egor", "Esan Central", "Esan North-East", "Esan South-East", "Esan West", "Etsako Central", "Etsako East", "Etsako West", "Igueben", "Ikpoba Okha", "Oredo", "Orhionmwon", "Ovia North-East", "Ovia South-West", "Owan East", "Owan West", "Uhunmwonde"] },
  { code: "EK", name: "Ekiti", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "EN", name: "Enugu", localGovernmentAreas: ["Aninri", "Awgu", "Enugu East", "Enugu North", "Enugu South", "Ezeagu", "Igbo Etiti", "Igbo Eze North", "Igbo Eze South", "Isi Uzo", "Nkanu East", "Nkanu West", "Nsukka", "Oji River", "Udenu", "Udi", "Uzo Uwani"] },
  { code: "FC", name: "FCT Abuja", localGovernmentAreas: ["Abaji", "Abuja Municipal", "Bwari", "Gwagwalada", "Kuje", "Kwali"] },
  { code: "GO", name: "Gombe", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "IM", name: "Imo", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "JI", name: "Jigawa", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "KD", name: "Kaduna", localGovernmentAreas: ["Birnin Gwari", "Chikun", "Giwa", "Igabi", "Ikara", "Jaba", "Jema'a", "Kachia", "Kaduna North", "Kaduna South", "Kagarko", "Kajuru", "Kauru", "Kubau", "Kudan", "Lere", "Makarfi", "Sabon Gari", "Sanga", "Soba", "Zangon Kataf", "Zaria"] },
  { code: "KN", name: "Kano", localGovernmentAreas: ["Ajingi", "Albasu", "Bagwai", "Bebeji", "Bichi", "Bunkure", "Dala", "Dambatta", "Dawakin Kudu", "Dawakin Tofa", "Doguwa", "Fagge", "Gabasawa", "Garko", "Garun Mallam", "Gaya", "Gezawa", "Gwale", "Gwarzo", "Kabo", "Kano Municipal", "Karaye", "Kibiya", "Kiru", "Kumbotso", "Kunchi", "Kura", "Madobi", "Makoda", "Minjibir", "Nasarawa", "Rano", "Rimin Gado", "Rogo", "Shanono", "Sumaila", "Takai", "Tarauni", "Tofa", "Tsanyawa", "Tudun Wada", "Ungogo", "Warawa", "Wudil"] },
  { code: "KT", name: "Katsina", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "KE", name: "Kebbi", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "KO", name: "Kogi", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "KW", name: "Kwara", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "LA", name: "Lagos", localGovernmentAreas: ["Agege", "Ajeromi-Ifelodun", "Alimosho", "Amuwo-Odofin", "Apapa", "Badagry", "Epe", "Eti-Osa", "Ibeju-Lekki", "Ifako-Ijaiye", "Ikeja", "Ikorodu", "Kosofe", "Lagos Island", "Lagos Mainland", "Mushin", "Ojo", "Oshodi-Isolo", "Shomolu", "Surulere"] },
  { code: "NA", name: "Nasarawa", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "NI", name: "Niger", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "OG", name: "Ogun", localGovernmentAreas: ["Abeokuta North", "Abeokuta South", "Ado-Odo/Ota", "Egbado North", "Egbado South", "Ewekoro", "Ifo", "Ijebu East", "Ijebu North", "Ijebu North East", "Ijebu Ode", "Ikenne", "Imeko Afon", "Ipokia", "Obafemi Owode", "Odeda", "Odogbolu", "Ogun Waterside", "Remo North", "Shagamu"] },
  { code: "ON", name: "Ondo", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "OS", name: "Osun", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "OY", name: "Oyo", localGovernmentAreas: ["Afijio", "Akinyele", "Atiba", "Atisbo", "Egbeda", "Ibadan North", "Ibadan North-East", "Ibadan North-West", "Ibadan South-East", "Ibadan South-West", "Ibarapa Central", "Ibarapa East", "Ibarapa North", "Ido", "Irepo", "Iseyin", "Itesiwaju", "Iwajowa", "Kajola", "Lagelu", "Ogbomosho North", "Ogbomosho South", "Ogo Oluwa", "Olorunsogo", "Oluyole", "Ona Ara", "Orelope", "Ori Ire", "Oyo East", "Oyo West", "Saki East", "Saki West", "Surulere"] },
  { code: "PL", name: "Plateau", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "RI", name: "Rivers", localGovernmentAreas: ["Abua/Odual", "Ahoada East", "Ahoada West", "Akuku-Toru", "Andoni", "Asari-Toru", "Bonny", "Degema", "Eleme", "Emohua", "Etche", "Gokana", "Ikwerre", "Khana", "Obio/Akpor", "Ogba/Egbema/Ndoni", "Ogu/Bolo", "Okrika", "Omuma", "Opobo/Nkoro", "Oyigbo", "Port Harcourt", "Tai"] },
  { code: "SO", name: "Sokoto", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "TA", name: "Taraba", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "YO", name: "Yobe", localGovernmentAreas: noLocalGovernmentAreasYet },
  { code: "ZA", name: "Zamfara", localGovernmentAreas: noLocalGovernmentAreasYet },
];

export function findNigeriaGeoStateByName(stateName: string): NigeriaGeoState | undefined {
  const normalisedName = stateName.trim().toLowerCase().replace(/^fct$/, "fct abuja");
  return nigeriaGeoStates.find((geoState) => geoState.name.toLowerCase() === normalisedName);
}
