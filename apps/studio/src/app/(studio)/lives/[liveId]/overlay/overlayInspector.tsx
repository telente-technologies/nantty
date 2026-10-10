"use client";

import type { OverlayLayer } from "@/types";

import partStyles from "./editorParts.module.css";
import baseStyles from "./page.module.css";

const styles = { ...baseStyles, ...partStyles };

const canvasWidth = 1920;
const canvasHeight = 1080;

function clampToRange(raw: string, minimum: number, maximum: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

interface OverlayInspectorProps {
  readonly selected: OverlayLayer;
  readonly onPatch: (patch: Partial<OverlayLayer>) => void;
  readonly onMove: (direction: 1 | -1) => void;
  readonly onRemove: () => void;
}

export function OverlayInspector({ selected, onPatch, onMove, onRemove }: OverlayInspectorProps) {
  return (
      <div className={styles.inspector}>
        <h2 className={styles.panelTitle}>{selected.name}</h2>

        {selected.type !== "shape" ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{selected.type === "image" ? "Image URL" : "Text"}</span>
            <input
              className={styles.input}
              value={selected.type === "image" ? (selected.src ?? "") : (selected.text ?? "")}
              onChange={(event) => onPatch(selected.type === "image" ? { src: event.target.value } : { text: event.target.value })}
            />
          </label>
        ) : null}

        {selected.type === "text" || selected.type === "countdown" || selected.type === "ticker" ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Font size (px at 1920)</span>
            <input
              className={styles.input}
              type="number"
              min={12}
              max={220}
              value={selected.fontSize ?? 48}
              onChange={(event) => onPatch({ fontSize: Number(event.target.value) })}
            />
          </label>
        ) : null}

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Text colour</span>
            <input className={styles.color} type="color" value={selected.color ?? "#ffffff"} onChange={(event) => onPatch({ color: event.target.value })} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Background</span>
            <input
              className={styles.color}
              type="color"
              value={selected.background ?? "#000000"}
              onChange={(event) => onPatch({ background: event.target.value })}
            />
          </label>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>X</span>
            <input className={styles.input} type="number" min={-canvasWidth} max={2 * canvasWidth} value={selected.x} onChange={(event) => onPatch({ x: clampToRange(event.target.value, -canvasWidth, 2 * canvasWidth) })} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Y</span>
            <input className={styles.input} type="number" min={-canvasHeight} max={2 * canvasHeight} value={selected.y} onChange={(event) => onPatch({ y: clampToRange(event.target.value, -canvasHeight, 2 * canvasHeight) })} />
          </label>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Width</span>
            <input className={styles.input} type="number" min={1} max={2 * canvasWidth} value={selected.width} onChange={(event) => onPatch({ width: clampToRange(event.target.value, 1, 2 * canvasWidth) })} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Height</span>
            <input className={styles.input} type="number" min={1} max={2 * canvasHeight} value={selected.height} onChange={(event) => onPatch({ height: clampToRange(event.target.value, 1, 2 * canvasHeight) })} />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Opacity · {Math.round(selected.opacity * 100)}%</span>
          <input
            className={styles.range}
            type="range"
            min={10}
            max={100}
            value={Math.round(selected.opacity * 100)}
            onChange={(event) => onPatch({ opacity: Number(event.target.value) / 100 })}
          />
        </label>

        <div className={styles.inspectorActions}>
          <button type="button" className={styles.smallButton} onClick={() => onMove(1)}>
            Bring forward
          </button>
          <button type="button" className={styles.smallButton} onClick={() => onMove(-1)}>
            Send back
          </button>
          <button type="button" className={styles.smallButtonDanger} onClick={onRemove}>
            Delete
          </button>
        </div>
      </div>
  );
}
