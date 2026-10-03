export interface StageTileFrame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const TILE_GAP = 2;

const describeGridForStreamerCount = (count: number) => {
  if (count <= 1) return { columns: 1, rows: 1 };
  if (count === 2) return { columns: 2, rows: 1 };
  if (count <= 4) return { columns: 2, rows: 2 };
  if (count <= 6) return { columns: 3, rows: 2 };
  if (count <= 9) return { columns: 3, rows: 3 };
  return { columns: 4, rows: 3 };
};

const buildUniformGridFrames = (count: number, slotCount: number, width: number, height: number, columns: number, rows: number) => {
  const tileWidth = (width - TILE_GAP * (columns - 1)) / columns;
  const tileHeight = (height - TILE_GAP * (rows - 1)) / rows;
  return Array.from({ length: Math.max(count, slotCount) }, (_, index): StageTileFrame => ({
    left: (index % columns) * (tileWidth + TILE_GAP),
    top: Math.floor(index / columns) * (tileHeight + TILE_GAP),
    width: tileWidth,
    height: tileHeight,
  }));
};

const buildHostSpotlightFramesForThree = (width: number, height: number): StageTileFrame[] => {
  const halfWidth = (width - TILE_GAP) / 2;
  const halfHeight = (height - TILE_GAP) / 2;
  return [
    { left: 0, top: 0, width: halfWidth, height },
    { left: halfWidth + TILE_GAP, top: 0, width: halfWidth, height: halfHeight },
    { left: halfWidth + TILE_GAP, top: halfHeight + TILE_GAP, width: halfWidth, height: halfHeight },
  ];
};

export const computeStageTileFramesForStreamerCount = (count: number, width: number, height: number) => {
  if (count === 3) return { frames: buildHostSpotlightFramesForThree(width, height), emptySeatCount: 0 };
  const { columns, rows } = describeGridForStreamerCount(count);
  const slotCount = columns * rows;
  return { frames: buildUniformGridFrames(count, slotCount, width, height, columns, rows), emptySeatCount: Math.max(0, slotCount - count) };
};

export const stageGridHeightForWidth = (count: number, width: number, maximumHeight: number) => {
  if (count <= 1) return maximumHeight;
  if (count === 2) return Math.min(maximumHeight, width * 0.75);
  return Math.min(maximumHeight, width * 1.15);
};
