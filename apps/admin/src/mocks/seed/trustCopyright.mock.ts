import { buildUnsplashImageUrl, unsplashPhotoIds } from "@/mocks/seed/unsplashPhotoIds.mock";
import { isoMinutesAgo, isoMinutesFromNow, type WritableRecord } from "@/mocks/seed/trustTime.mock";
import type { CopyrightClaimDetail } from "@/types/copyright.type";

export type MockCopyrightClaimRecord = WritableRecord<Omit<CopyrightClaimDetail, "infringer" | "infringerStrikeCount" | "history" | "topAudioMatchConfidencePercent" | "repeatInfringerThreshold">> & {
  infringerUserId: string;
};

const image = (photoId: string) => buildUnsplashImageUrl(photoId, 480);

export function buildDemoCopyrightClaims(): MockCopyrightClaimRecord[] {
  return [
    {
      id: "cpc_0001", infringerUserId: "usr_0016", status: "PENDING", targetFlag: "LIMITED", filedAt: isoMinutesAgo(380), workType: "SOUND",
      claimant: { name: "Folake Adisa", organization: "Eko Sound Records Ltd", email: "rights.ekosound@example.com", representativeOf: "Ayo Kolade" },
      workTitle: "Ayo Kolade — Lagos Nights (Official Audio)",
      target: { type: "CLIP", id: "clp_41220", title: "Friday night in VI 🌃", text: "Vibes only", mediaUrls: [image(unsplashPhotoIds.posts.lagosSkyline[1])], soundTitle: "Lagos Nights (sped up) — bolu.films", visibility: "VISIBLE", createdAt: isoMinutesAgo(1900) },
      rightsBasis: "Exclusive master recording and publishing rights, registered with COSON (ref. COSON/2025/44712).",
      swornStatement: "I have a good faith belief that use of the material in the manner complained of is not authorised by the copyright owner, its agent, or the law. The information in this notice is accurate, and under penalty of perjury, I am authorised to act on behalf of the owner.",
      claimedUrls: ["https://nantty.com/c/clp_41220"],
      audioMatches: [
        { matchedTrack: "Lagos Nights (Official Audio)", artist: "Ayo Kolade", confidencePercent: 97, source: "Nantty audio fingerprint v3", segments: [{ targetStartSeconds: 0, targetEndSeconds: 28, referenceStartSeconds: 41 }] },
        { matchedTrack: "Lagos Nights (Remix)", artist: "Ayo Kolade ft. DJ Temi", confidencePercent: 62, source: "Nantty audio fingerprint v3", segments: [{ targetStartSeconds: 4, targetEndSeconds: 12, referenceStartSeconds: 88 }] },
      ],
      counterNotices: [], decision: null, claimScope: "AUDIO",
      evidence: {
        originalWorkUrl: "https://music.example/ayo-kolade/lagos-nights", originalWorkMediaId: null, proofUrls: ["https://coson.example/registry/COSON-2025-44712", "https://distributor.example/releases/lagos-nights"], proofMediaIds: [],
        segments: [{ startSeconds: 0, endSeconds: 28 }], accuracyDeclared: true, signatureName: "Folake Adisa", signedAt: isoMinutesAgo(380), claimantPhone: "+234 801 000 0000", claimantAddress: null,
      },
    },
    {
      id: "cpc_0002", infringerUserId: "usr_0001", status: "PENDING", targetFlag: "VISIBLE", filedAt: isoMinutesAgo(1300), workType: "IMAGE",
      claimant: { name: "Tobi Adewale", organization: null, email: "tobi.adewale@example.com", representativeOf: null },
      workTitle: "Editorial photo 'Aso-ebi Saturday' (2025)",
      target: { type: "POST", id: "pst_20511", title: null, text: "New aso-ebi collection dropping Friday! Order now.", mediaUrls: [image(unsplashPhotoIds.posts.weddingAsoEbi[0])], soundTitle: null, visibility: "VISIBLE", createdAt: isoMinutesAgo(4000) },
      rightsBasis: "I am the photographer and sole owner. Original RAW files and EXIF available.",
      swornStatement: "I swear the information is accurate and that I am the copyright owner.",
      claimedUrls: ["https://nantty.com/p/pst_20511"],
      audioMatches: [], counterNotices: [], decision: null,
    },
    {
      id: "cpc_0003", infringerUserId: "usr_0025", status: "COUNTER_NOTICE", targetFlag: "TAKEN_DOWN", filedAt: isoMinutesAgo(9000), workType: "SOUND",
      claimant: { name: "Kunle Bamidele", organization: "Highlife Heritage Publishing", email: "claims.highlife@example.com", representativeOf: null },
      workTitle: "Sweet Mother (1976 recording)",
      target: { type: "SOUND", id: "snd_7710", title: "Sweet Mother (yemi.sound edit)", text: "Remix used in 1,240 clips", mediaUrls: [image(unsplashPhotoIds.posts.familyDinner[0])], soundTitle: "Sweet Mother (yemi.sound edit)", visibility: "REMOVED", createdAt: isoMinutesAgo(20000) },
      rightsBasis: "Publishing administrator for the composition.",
      swornStatement: "I swear under penalty of perjury that I am authorised to act for the owner.",
      claimedUrls: ["https://nantty.com/s/snd_7710"],
      audioMatches: [{ matchedTrack: "Sweet Mother", artist: "Prince Nico Mbarga", confidencePercent: 71, source: "Nantty audio fingerprint v3", segments: [{ targetStartSeconds: 12, targetEndSeconds: 40, referenceStartSeconds: 0 }] }],
      counterNotices: [{ id: "ctn_0001", submittedAt: isoMinutesAgo(2000), statement: "I licensed the sample through AudioSalad licence #AS-88213. The edit is transformative and credited.", status: "PENDING", restoreEligibleAt: isoMinutesFromNow(12_000) }],
      decision: { outcome: "UPHELD", reason: "Fingerprint match on the composition; no licence on file at the time.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(8000) },
    },
    {
      id: "cpc_0004", infringerUserId: "usr_0018", status: "UPHELD", targetFlag: "TAKEN_DOWN", filedAt: isoMinutesAgo(30000), workType: "VIDEO",
      claimant: { name: "Nollywood Premiere Ltd", organization: "Nollywood Premiere Ltd", email: "legal.nollypremiere@example.com", representativeOf: null },
      workTitle: "Feature film 'Ile Ayo' (2026)",
      target: { type: "CLIP", id: "clp_36001", title: "Ile Ayo full movie part 1", text: null, mediaUrls: [image(unsplashPhotoIds.posts.cameraGear[0])], soundTitle: null, visibility: "REMOVED", createdAt: isoMinutesAgo(31000) },
      rightsBasis: "Producer and distributor.", swornStatement: "Sworn by legal counsel.", claimedUrls: ["https://nantty.com/c/clp_36001"],
      audioMatches: [], counterNotices: [],
      decision: { outcome: "UPHELD", reason: "Full-length reupload of a film in cinemas.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(29000) },
    },
    {
      id: "cpc_0005", infringerUserId: "usr_0002", status: "REJECTED", targetFlag: "VISIBLE", filedAt: isoMinutesAgo(15000), workType: "IMAGE",
      claimant: { name: "Jollof Kings", organization: "Jollof Kings Restaurant", email: "hello.jollofkings@example.com", representativeOf: null },
      workTitle: "Menu photography",
      target: { type: "POST", id: "pst_18820", title: null, text: "Honest review of Jollof Kings. 6/10.", mediaUrls: [image(unsplashPhotoIds.posts.jollofRice[0])], soundTitle: null, visibility: "VISIBLE", createdAt: isoMinutesAgo(16000) },
      rightsBasis: "We own our menu photos.", swornStatement: "Sworn.", claimedUrls: ["https://nantty.com/p/pst_18820"],
      audioMatches: [], counterNotices: [],
      decision: { outcome: "REJECTED", reason: "Photo was taken by the creator in the restaurant; review is fair use.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(14000) },
    },
  ];
}
