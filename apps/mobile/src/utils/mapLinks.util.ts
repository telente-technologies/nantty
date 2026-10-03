import { Platform } from "react-native";

const MAP_TILE_SIZE_PIXELS = 256;
const MAP_PREVIEW_ZOOM = 15;

export interface MapTileInGrid {
  readonly key: string;
  readonly url: string;
  readonly left: number;
  readonly top: number;
}

export interface MapTileGrid {
  readonly tiles: readonly MapTileInGrid[];
  readonly pointLeft: number;
  readonly pointTop: number;
  readonly sizePixels: number;
}

export const buildMapsUrl = (latitude: number, longitude: number, label?: string | null) => {
  const encodedLabel = encodeURIComponent(label ?? "Shared location");
  if (Platform.OS === "ios") return `https://maps.apple.com/?ll=${latitude},${longitude}&q=${encodedLabel}`;
  if (Platform.OS === "android") return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
};

export const buildOpenStreetMapTileGrid = (latitude: number, longitude: number): MapTileGrid => {
  const tileCount = 2 ** MAP_PREVIEW_ZOOM;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const tileX = ((longitude + 180) / 360) * tileCount;
  const tileY = ((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2) * tileCount;
  const firstTileX = Math.floor(tileX - 0.5);
  const firstTileY = Math.floor(tileY - 0.5);
  const tiles: MapTileInGrid[] = [];
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const x = firstTileX + column;
      const y = firstTileY + row;
      tiles.push({ key: `${x}/${y}`, url: `https://tile.openstreetmap.org/${MAP_PREVIEW_ZOOM}/${x}/${y}.png`, left: column * MAP_TILE_SIZE_PIXELS, top: row * MAP_TILE_SIZE_PIXELS });
    }
  }
  return {
    tiles,
    pointLeft: (tileX - firstTileX) * MAP_TILE_SIZE_PIXELS,
    pointTop: (tileY - firstTileY) * MAP_TILE_SIZE_PIXELS,
    sizePixels: MAP_TILE_SIZE_PIXELS * 2,
  };
};

export const formatLiveUntilTime = (liveUntil: string) =>
  new Date(liveUntil).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
