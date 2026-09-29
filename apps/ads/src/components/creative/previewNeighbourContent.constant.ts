export interface NeighbourProductTile {
  readonly key: string;
  readonly title: string;
  readonly imageUrl: string;
  readonly priceRatio: number;
  readonly rating: number;
}

export interface NeighbourLiveCard {
  readonly key: string;
  readonly hostName: string;
  readonly title: string;
  readonly posterUrl: string;
  readonly viewerCount: number;
}

function buildUnsplashUrl(photoId: string): string {
  return `https://images.unsplash.com/photo-${photoId}?w=400&q=80&fm=webp`;
}

export const neighbourProductTiles: readonly NeighbourProductTile[] = [
  { key: "headphones", title: "Wireless Over-Ear Headphones", imageUrl: buildUnsplashUrl("1505740420928-5e560c06d30e"), priceRatio: 1.9, rating: 4.6 },
  { key: "sunglasses", title: "Classic Sunglasses", imageUrl: buildUnsplashUrl("1572635196237-14b3f281503f"), priceRatio: 0.7, rating: 4.4 },
  { key: "candle", title: "Scented Candle — Lagos Rain", imageUrl: buildUnsplashUrl("1603006905003-be475563bc59"), priceRatio: 0.45, rating: 4.8 },
];

export const neighbourLiveCards: readonly NeighbourLiveCard[] = [
  { key: "kitchen", hostName: "Mama Nkechi Kitchen", title: "Fresh juice bar restock", posterUrl: buildUnsplashUrl("1600271886742-f049cd451bba"), viewerCount: 312 },
  { key: "glow", hostName: "Glow by Temi", title: "Body oil Q&A", posterUrl: buildUnsplashUrl("1611930022073-b7a4ba5fcccd"), viewerCount: 187 },
  { key: "leather", hostName: "Aba Leather Hub", title: "Crossbody bags, new colours", posterUrl: buildUnsplashUrl("1600857062241-98e5dba7f214"), viewerCount: 96 },
];
