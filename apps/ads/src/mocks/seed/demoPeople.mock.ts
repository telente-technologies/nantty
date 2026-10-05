export const demoAccountPassword = "Zudomart2026!";

export interface MockUserRecord {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly email: string;
  readonly avatarUrl: string | null;
}

export const demoUsers: readonly MockUserRecord[] = [
  { id: "usr_adaeze", name: "Adaeze Okafor", username: "adaeze.okafor", email: "adaeze@ifelifestyle.ng", avatarUrl: null },
  { id: "usr_tunde", name: "Tunde Bakare", username: "tunde.bakare", email: "tunde@ifelifestyle.ng", avatarUrl: null },
  { id: "usr_blessing", name: "Blessing Eze", username: "blessing.eze", email: "blessing@ifelifestyle.ng", avatarUrl: null },
  { id: "usr_ibrahim", name: "Ibrahim Musa", username: "ibrahim.musa", email: "ibrahim@ifelifestyle.ng", avatarUrl: null },
  { id: "usr_kelechi", name: "Kelechi Obi", username: "kelechi.kicks", email: "kelechi@kelechikicks.ng", avatarUrl: null },
  { id: "usr_ama", name: "Ama Mensah", username: "ama.kente", email: "ama@kenteheritage.com.gh", avatarUrl: null },
];
