import { buildUnsplashImageUrl, unsplashPhotoIds } from "@/mocks/seed/unsplashPhotoIds.mock";
import type { IpClaimDecision, IpClaimEvidence, IpClaimSellerResponse, IpClaimStatus, IpClaimType } from "@/types/ipClaims.type";

export interface MockIpClaimListing {
  id: string;
  title: string;
  amountMinor: number;
  photoId: string;
  storeName: string;
  status: "LIVE" | "DELISTED";
}

export interface MockIpClaimRecord {
  id: string;
  type: IpClaimType;
  status: IpClaimStatus;
  claimantBrandId: string;
  accusedSellerUserId: string;
  listing: MockIpClaimListing;
  filedAt: string;
  slaDueAt: string;
  statement: string;
  trademarkReference: string | null;
  evidence: IpClaimEvidence[];
  sellerResponse: IpClaimSellerResponse | null;
  decision: IpClaimDecision | null;
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

const image = (photoId: string) => buildUnsplashImageUrl(photoId, 640);

export function buildDemoIpClaims(): MockIpClaimRecord[] {
  return [
    {
      id: "ipc_0001", type: "COUNTERFEIT", status: "OPEN", claimantBrandId: "brd_0001", accusedSellerUserId: "usr_0005",
      listing: { id: "lst_55012", title: "Adire Lagos indigo two-piece (original)", amountMinor: 1_850_000, photoId: unsplashPhotoIds.posts.weddingAsoEbi[2], storeName: "Emeka Gadgets & More", status: "LIVE" },
      filedAt: hoursAgoIso(30), slaDueAt: hoursAgoIso(-18),
      statement: "This seller uses our registered name and product photos from our lookbook. We never supplied them. Our test purchase arrived with printed (not hand-dyed) fabric and a fake Adire Lagos tag.",
      trademarkReference: "NG/TM/O/2021/48213",
      evidence: [
        { id: "ev_0001", kind: "TEST_PURCHASE_PHOTO", caption: "Test purchase received 12 Sept: printed fabric, fake swing tag", imageUrl: image(unsplashPhotoIds.posts.weddingAsoEbi[0]) },
        { id: "ev_0002", kind: "SIDE_BY_SIDE", caption: "Our original (left) vs listing item (right): dye pattern and stitching differ", imageUrl: image(unsplashPhotoIds.posts.weddingAsoEbi[1]) },
        { id: "ev_0003", kind: "REGISTRATION_REFERENCE", caption: "Trademark NG/TM/O/2021/48213, class 25", imageUrl: null },
      ],
      sellerResponse: null,
      decision: null,
    },
    {
      id: "ipc_0002", type: "TRADEMARK", status: "OPEN", claimantBrandId: "brd_0005", accusedSellerUserId: "usr_0026",
      listing: { id: "lst_61877", title: "Zobo Republic style hibiscus drink, 6-pack", amountMinor: 480_000, photoId: unsplashPhotoIds.products.fd5[0], storeName: "Grace Decor", status: "LIVE" },
      filedAt: hoursAgoIso(20), slaDueAt: hoursAgoIso(-28),
      statement: "The listing title uses our registered word mark to sell a different drink.",
      trademarkReference: "NG/TM/O/2022/60318",
      evidence: [{ id: "ev_0004", kind: "NOTE", caption: "Listing title and first photo use 'Zobo Republic'", imageUrl: image(unsplashPhotoIds.products.fd5[1]) }],
      sellerResponse: { submittedAt: hoursAgoIso(6), statement: "I only wrote 'style' to describe the taste. I can change the title today." },
      decision: null,
    },
    {
      id: "ipc_0003", type: "COUNTERFEIT", status: "OPEN", claimantBrandId: "brd_0003", accusedSellerUserId: "usr_0023",
      listing: { id: "lst_40220", title: "Funke Naturals raw shea butter 500g", amountMinor: 650_000, photoId: unsplashPhotoIds.products.b6[1], storeName: "Jide Kicks", status: "LIVE" },
      filedAt: hoursAgoIso(70), slaDueAt: hoursAgoIso(22),
      statement: "Jars use our label design with a misspelt address. Buyers are messaging us about rashes.",
      trademarkReference: null,
      evidence: [
        { id: "ev_0005", kind: "TEST_PURCHASE_PHOTO", caption: "Label reads 'Ibadan Rd' — our factory is in Ogbomoso", imageUrl: image(unsplashPhotoIds.products.b6[0]) },
        { id: "ev_0006", kind: "NOTE", caption: "Three buyer complaints forwarded to support (tickets on file)", imageUrl: null },
      ],
      sellerResponse: null,
      decision: null,
    },
    {
      id: "ipc_0004", type: "TRADEMARK", status: "NEEDS_INFO", claimantBrandId: "brd_0006", accusedSellerUserId: "usr_0017",
      listing: { id: "lst_38841", title: "KB Records tour tee 2025", amountMinor: 18_000, photoId: unsplashPhotoIds.products.f2[0], storeName: "Nana Ama Shop", status: "LIVE" },
      filedAt: hoursAgoIso(120), slaDueAt: hoursAgoIso(-48),
      statement: "Unlicensed tour merchandise using our label logo.",
      trademarkReference: "GH/TM/2020/11842",
      evidence: [{ id: "ev_0007", kind: "SIDE_BY_SIDE", caption: "Official tee vs listing", imageUrl: image(unsplashPhotoIds.products.f2[1]) }],
      sellerResponse: { submittedAt: hoursAgoIso(90), statement: "I bought these from the tour venue in Accra and I am reselling them." },
      decision: { outcome: "NEEDS_INFO", reason: "The brand's official status was revoked; ask the claimant for proof it still owns the mark.", decidedAt: hoursAgoIso(80), decidedByName: "Chidi Okafor", strikeAdded: false },
    },
    {
      id: "ipc_0005", type: "COUNTERFEIT", status: "UPHELD", claimantBrandId: "brd_0001", accusedSellerUserId: "usr_0005",
      listing: { id: "lst_50007", title: "Adire Lagos kimono jacket", amountMinor: 2_200_000, photoId: unsplashPhotoIds.posts.weddingAsoEbi[0], storeName: "Emeka Gadgets & More", status: "DELISTED" },
      filedAt: hoursAgoIso(900), slaDueAt: hoursAgoIso(852),
      statement: "Counterfeit jacket using our brand name.",
      trademarkReference: "NG/TM/O/2021/48213",
      evidence: [{ id: "ev_0008", kind: "TEST_PURCHASE_PHOTO", caption: "Machine print, fake tag", imageUrl: image(unsplashPhotoIds.posts.weddingAsoEbi[1]) }],
      sellerResponse: null,
      decision: { outcome: "UPHELD", reason: "Test purchase confirms a counterfeit. Listing delisted and strike added.", decidedAt: hoursAgoIso(860), decidedByName: "Chidi Okafor", strikeAdded: true },
    },
  ];
}
