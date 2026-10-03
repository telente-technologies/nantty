"use client";

import type { OverlayLayer } from "@/types";

import { layerStyle } from "./overlayLayers.util";
import styles from "./page.module.css";

interface OverlayCanvasProps {
  readonly layers: readonly OverlayLayer[];
  readonly selectedId: string | null;
  readonly overlayUrl: string;
  readonly onSelect: (layerId: string) => void;
}

export function OverlayCanvas({ layers, selectedId, overlayUrl, onSelect }: OverlayCanvasProps) {
  return (
  <section className={styles.canvasWrap}>
    <div className={styles.canvas}>
      {layers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          className={`${styles.layer} ${selectedId === layer.id ? styles.layerSelected : ""}`}
          style={layerStyle(layer)}
          onClick={() => onSelect(layer.id)}
        >
          {layer.type === "shape" ? null : layer.type === "image" ? (
            layer.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={layer.src} alt="" className={styles.layerImage} />
            ) : (
              <span className={styles.layerPlaceholder}>Logo</span>
            )
          ) : (
            layer.text
          )}
        </button>
      ))}
      {layers.length === 0 ? <p className={styles.canvasEmpty}>No layers yet. Add text or your logo to get started.</p> : null}
    </div>
    <div className={styles.browserSourceRow}>
      <span className={styles.browserSourceLabel}>OBS browser source</span>
      <code className={styles.browserSourceUrl}>{overlayUrl}</code>
      <button
        type="button"
        className={styles.copyButton}
        onClick={() => navigator.clipboard?.writeText(overlayUrl)}
      >
        Copy URL
      </button>
    </div>
  </section>
  );
}
