export interface BundledCountryPlaces {
  readonly countryCode: "NG" | "GH" | "KE" | "ZA";
  readonly countryName: string;
  readonly places: readonly (readonly [name: string, region: string])[];
}

export const BUNDLED_COUNTRY_PLACES: readonly BundledCountryPlaces[] = [
  {
    countryCode: "NG",
    countryName: "Nigeria",
    places: [
      ["Lagos", "Lagos"], ["Ikeja", "Lagos"], ["Lekki", "Lagos"], ["Victoria Island", "Lagos"], ["Ikoyi", "Lagos"], ["Yaba", "Lagos"], ["Surulere", "Lagos"],
      ["Ajah", "Lagos"], ["Festac Town", "Lagos"], ["Ikorodu", "Lagos"], ["Epe", "Lagos"], ["Badagry", "Lagos"], ["Apapa", "Lagos"], ["Gbagada", "Lagos"],
      ["Maryland", "Lagos"], ["Magodo", "Lagos"], ["Ojota", "Lagos"], ["Abuja", "FCT"], ["Wuse", "FCT"], ["Garki", "FCT"], ["Maitama", "FCT"], ["Asokoro", "FCT"],
      ["Gwarinpa", "FCT"], ["Kubwa", "FCT"], ["Lugbe", "FCT"], ["Ibadan", "Oyo"], ["Ogbomosho", "Oyo"], ["Oyo", "Oyo"], ["Kano", "Kano"], ["Kaduna", "Kaduna"],
      ["Zaria", "Kaduna"], ["Port Harcourt", "Rivers"], ["Bonny", "Rivers"], ["Benin City", "Edo"], ["Auchi", "Edo"], ["Enugu", "Enugu"], ["Nsukka", "Enugu"],
      ["Onitsha", "Anambra"], ["Awka", "Anambra"], ["Nnewi", "Anambra"], ["Aba", "Abia"], ["Umuahia", "Abia"], ["Owerri", "Imo"], ["Abeokuta", "Ogun"],
      ["Ijebu Ode", "Ogun"], ["Sagamu", "Ogun"], ["Ota", "Ogun"], ["Ilorin", "Kwara"], ["Osogbo", "Osun"], ["Ile-Ife", "Osun"], ["Ilesa", "Osun"],
      ["Akure", "Ondo"], ["Ondo", "Ondo"], ["Ado Ekiti", "Ekiti"], ["Lokoja", "Kogi"], ["Makurdi", "Benue"], ["Jos", "Plateau"], ["Bauchi", "Bauchi"],
      ["Maiduguri", "Borno"], ["Yola", "Adamawa"], ["Sokoto", "Sokoto"], ["Katsina", "Katsina"], ["Minna", "Niger"], ["Calabar", "Cross River"],
      ["Uyo", "Akwa Ibom"], ["Eket", "Akwa Ibom"], ["Asaba", "Delta"], ["Warri", "Delta"], ["Sapele", "Delta"], ["Yenagoa", "Bayelsa"], ["Abakaliki", "Ebonyi"],
      ["Lafia", "Nasarawa"], ["Keffi", "Nasarawa"], ["Gombe", "Gombe"], ["Jalingo", "Taraba"], ["Damaturu", "Yobe"], ["Dutse", "Jigawa"], ["Birnin Kebbi", "Kebbi"],
      ["Gusau", "Zamfara"],
    ],
  },
  {
    countryCode: "GH",
    countryName: "Ghana",
    places: [
      ["Accra", "Greater Accra"], ["East Legon", "Greater Accra"], ["Osu", "Greater Accra"], ["Airport Residential", "Greater Accra"], ["Cantonments", "Greater Accra"],
      ["Madina", "Greater Accra"], ["Spintex", "Greater Accra"], ["Tema", "Greater Accra"], ["Kasoa", "Central"], ["Kumasi", "Ashanti"], ["Obuasi", "Ashanti"],
      ["Ejisu", "Ashanti"], ["Takoradi", "Western"], ["Sekondi", "Western"], ["Tarkwa", "Western"], ["Cape Coast", "Central"], ["Winneba", "Central"],
      ["Elmina", "Central"], ["Koforidua", "Eastern"], ["Nkawkaw", "Eastern"], ["Ho", "Volta"], ["Hohoe", "Volta"], ["Tamale", "Northern"], ["Yendi", "Northern"],
      ["Bolgatanga", "Upper East"], ["Wa", "Upper West"], ["Sunyani", "Bono"], ["Techiman", "Bono East"], ["Dambai", "Oti"], ["Goaso", "Ahafo"],
      ["Sefwi Wiawso", "Western North"], ["Nalerigu", "North East"], ["Damongo", "Savannah"],
    ],
  },
  {
    countryCode: "KE",
    countryName: "Kenya",
    places: [
      ["Nairobi", "Nairobi"], ["Westlands", "Nairobi"], ["Kilimani", "Nairobi"], ["Karen", "Nairobi"], ["Lavington", "Nairobi"], ["Kileleshwa", "Nairobi"],
      ["Eastleigh", "Nairobi"], ["Embakasi", "Nairobi"], ["Kasarani", "Nairobi"], ["Mombasa", "Mombasa"], ["Nyali", "Mombasa"], ["Kisumu", "Kisumu"],
      ["Nakuru", "Nakuru"], ["Naivasha", "Nakuru"], ["Eldoret", "Uasin Gishu"], ["Thika", "Kiambu"], ["Kiambu", "Kiambu"], ["Ruiru", "Kiambu"], ["Machakos", "Machakos"],
      ["Athi River", "Machakos"], ["Kitengela", "Kajiado"], ["Malindi", "Kilifi"], ["Kilifi", "Kilifi"], ["Diani", "Kwale"], ["Lamu", "Lamu"], ["Nyeri", "Nyeri"],
      ["Meru", "Meru"], ["Embu", "Embu"], ["Kericho", "Kericho"], ["Kisii", "Kisii"], ["Kakamega", "Kakamega"], ["Bungoma", "Bungoma"], ["Kitale", "Trans Nzoia"],
      ["Garissa", "Garissa"], ["Nanyuki", "Laikipia"], ["Narok", "Narok"], ["Voi", "Taita Taveta"], ["Lodwar", "Turkana"],
    ],
  },
  {
    countryCode: "ZA",
    countryName: "South Africa",
    places: [
      ["Johannesburg", "Gauteng"], ["Sandton", "Gauteng"], ["Soweto", "Gauteng"], ["Rosebank", "Gauteng"], ["Midrand", "Gauteng"], ["Randburg", "Gauteng"],
      ["Pretoria", "Gauteng"], ["Centurion", "Gauteng"], ["Benoni", "Gauteng"], ["Germiston", "Gauteng"], ["Cape Town", "Western Cape"], ["Stellenbosch", "Western Cape"],
      ["Paarl", "Western Cape"], ["George", "Western Cape"], ["Knysna", "Western Cape"], ["Sea Point", "Western Cape"], ["Durban", "KwaZulu-Natal"],
      ["Umhlanga", "KwaZulu-Natal"], ["Pietermaritzburg", "KwaZulu-Natal"], ["Richards Bay", "KwaZulu-Natal"], ["Gqeberha", "Eastern Cape"], ["East London", "Eastern Cape"],
      ["Mthatha", "Eastern Cape"], ["Bloemfontein", "Free State"], ["Welkom", "Free State"], ["Polokwane", "Limpopo"], ["Mbombela", "Mpumalanga"],
      ["Emalahleni", "Mpumalanga"], ["Rustenburg", "North West"], ["Mahikeng", "North West"], ["Kimberley", "Northern Cape"], ["Upington", "Northern Cape"],
    ],
  },
];
