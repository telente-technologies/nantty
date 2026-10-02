"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState, Spinner } from "@/components/ui/feedback";
import { RetryButton } from "@/components/ui/controls";
import { readPublicSiteUrl } from "@/config/studioEnvironment.config";
import { livesService } from "@/services/lives.service";
import type { OverlayLayer, OverlayLayerType } from "@/types";
import { useQuery } from "@tanstack/react-query";

import styles from "./page.module.css";

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

const ADDABLE: readonly { readonly type: OverlayLayerType; readonly label: string }[] = [
  { type: "text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "shape", label: "Shape" },
  { type: "countdown", label: "Countdown" },
  { type: "ticker", label: "Ticker" },
];

function buildLayer(type: OverlayLayerType, index: number): OverlayLayer {
  const base = {
    id: `layer_${Date.now()}_${index}`,
    type,
    name: `${type.charAt(0).toUpperCase()}${type.slice(1)} ${index + 1}`,
    x: 120,
    y: 820,
    width: type === "shape" ? 240 : 640,
    height: type === "shape" ? 240 : 120,
    zIndex: 30 + index,
    opacity: 1,
  } as const;
  switch (type) {
    case "text":
      return { ...base, text: "Your headline here", fontSize: 56, color: "#ffffff", background: "#0b1752", radius: 8 };
    case "image":
      return { ...base, text: "Logo image URL", src: "", width: 220, height: 220, radius: 12 };
    case "shape":
      return { ...base, background: "#2043f5", radius: 16, x: 1600, y: 80 };
    case "countdown":
      return { ...base, text: "00:10:00", fontSize: 72, color: "#ffffff", background: "#0a0a14", radius: 12 };
    case "ticker":
      return { ...base, text: "Running text for your stream", fontSize: 44, color: "#0a0a14", background: "#f5e320", y: 980, height: 80 };
    default:
      return { ...base, text: "", color: "#ffffff" };
  }
}

function layerStyle(layer: OverlayLayer): React.CSSProperties {
  return {
    left: `${(layer.x / CANVAS_WIDTH) * 100}%`,
    top: `${(layer.y / CANVAS_HEIGHT) * 100}%`,
    width: `${(layer.width / CANVAS_WIDTH) * 100}%`,
    height: `${(layer.height / CANVAS_HEIGHT) * 100}%`,
    zIndex: layer.zIndex,
    opacity: layer.opacity,
    background: layer.background,
    borderRadius: layer.radius ? `${layer.radius}px` : undefined,
    fontSize: layer.fontSize ? `${layer.fontSize / 19.2}cqw` : undefined,
    color: layer.color,
  };
}

export default function OverlayEditorPage({ params }: { readonly params: Promise<{ readonly liveId: string }> }) {
  const { liveId } = use(params);
  const scene = useQuery({ queryKey: ["overlay-scene", liveId], queryFn: () => livesService.fetchOverlays(liveId) });

  const [layers, setLayers] = useState<OverlayLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (scene.data && !dirty) setLayers([...scene.data.layers]);
  }, [scene.data, dirty]);

  const selected = useMemo(() => layers.find((layer) => layer.id === selectedId) ?? null, [layers, selectedId]);

  const mutateLayers = (change: (current: OverlayLayer[]) => OverlayLayer[]) => {
    setLayers((current) => change(current));
    setDirty(true);
    setSaved(false);
  };

  const patchSelected = (patch: Partial<OverlayLayer>) => {
    if (!selectedId) return;
    mutateLayers((current) => current.map((layer) => (layer.id === selectedId ? { ...layer, ...patch } : layer)));
  };

  const addLayer = (type: OverlayLayerType) => {
    const layer = buildLayer(type, layers.length);
    mutateLayers((current) => [...current, layer]);
    setSelectedId(layer.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    mutateLayers((current) => current.filter((layer) => layer.id !== selectedId));
    setSelectedId(null);
  };

  const moveSelected = (direction: 1 | -1) => {
    if (!selectedId) return;
    mutateLayers((current) =>
      current.map((layer) => (layer.id === selectedId ? { ...layer, zIndex: layer.zIndex + direction } : layer)),
    );
  };

  async function save() {
    setSaveError(null);
    try {
      await livesService.saveOverlays(liveId, { name: scene.data?.name ?? "Main scene", layers });
      setDirty(false);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't save the overlay.");
    }
  }

  if (scene.isLoading) return <Spinner label="Loading overlay" />;
  if (scene.isError || !scene.data) {
    return <ErrorState title="Overlay unavailable" description="We couldn't load this scene." action={<RetryButton onRetry={() => scene.refetch()} />} />;
  }

  const overlayUrl = `${readPublicSiteUrl()}/overlay/${scene.data.id}`;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <Link href={`/lives/${liveId}`} className={styles.back}>
            Back to control room
          </Link>
          <h1 className={styles.title}>Overlay editor</h1>
          <p className={styles.subtitle}>Add text, your logo or shapes. They render on top of your stream at 1920 × 1080.</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => setDirty(false)} disabled={!dirty}>
            Discard changes
          </Button>
          <Button busy={false} onClick={save} disabled={!dirty}>
            Save overlay
          </Button>
        </div>
      </header>

      {saved ? (
        <p className={styles.savedNote} role="status">
          Saved. Your OBS browser source will refresh with the new layers.
        </p>
      ) : null}
      {saveError ? (
        <p className={styles.errorNote} role="alert">
          {saveError}
        </p>
      ) : null}

      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>Add layer</span>
        {ADDABLE.map((entry) => (
          <button key={entry.type} type="button" className={styles.toolButton} onClick={() => addLayer(entry.type)}>
            {entry.label}
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        <section className={styles.canvasWrap}>
          <div className={styles.canvas}>
            {layers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                className={`${styles.layer} ${selectedId === layer.id ? styles.layerSelected : ""}`}
                style={layerStyle(layer)}
                onClick={() => setSelectedId(layer.id)}
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

        <aside className={styles.sidePanel}>
          <h2 className={styles.panelTitle}>Layers</h2>
          <ul className={styles.layerList}>
            {[...layers]
              .sort((a, b) => b.zIndex - a.zIndex)
              .map((layer) => (
                <li key={layer.id}>
                  <button
                    type="button"
                    className={`${styles.layerRow} ${selectedId === layer.id ? styles.layerRowActive : ""}`}
                    onClick={() => setSelectedId(layer.id)}
                  >
                    {layer.name}
                  </button>
                </li>
              ))}
          </ul>
          {layers.length === 0 ? <p className={styles.muted}>Nothing on this scene yet.</p> : null}

          {selected ? (
            <div className={styles.inspector}>
              <h2 className={styles.panelTitle}>{selected.name}</h2>

              {selected.type !== "shape" ? (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{selected.type === "image" ? "Image URL" : "Text"}</span>
                  <input
                    className={styles.input}
                    value={selected.type === "image" ? (selected.src ?? "") : (selected.text ?? "")}
                    onChange={(event) => patchSelected(selected.type === "image" ? { src: event.target.value } : { text: event.target.value })}
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
                    onChange={(event) => patchSelected({ fontSize: Number(event.target.value) })}
                  />
                </label>
              ) : null}

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Text colour</span>
                  <input className={styles.color} type="color" value={selected.color ?? "#ffffff"} onChange={(event) => patchSelected({ color: event.target.value })} />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Background</span>
                  <input
                    className={styles.color}
                    type="color"
                    value={selected.background ?? "#000000"}
                    onChange={(event) => patchSelected({ background: event.target.value })}
                  />
                </label>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>X</span>
                  <input className={styles.input} type="number" value={selected.x} onChange={(event) => patchSelected({ x: Number(event.target.value) })} />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Y</span>
                  <input className={styles.input} type="number" value={selected.y} onChange={(event) => patchSelected({ y: Number(event.target.value) })} />
                </label>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Width</span>
                  <input className={styles.input} type="number" value={selected.width} onChange={(event) => patchSelected({ width: Number(event.target.value) })} />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Height</span>
                  <input className={styles.input} type="number" value={selected.height} onChange={(event) => patchSelected({ height: Number(event.target.value) })} />
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
                  onChange={(event) => patchSelected({ opacity: Number(event.target.value) / 100 })}
                />
              </label>

              <div className={styles.inspectorActions}>
                <button type="button" className={styles.smallButton} onClick={() => moveSelected(1)}>
                  Bring forward
                </button>
                <button type="button" className={styles.smallButton} onClick={() => moveSelected(-1)}>
                  Send back
                </button>
                <button type="button" className={styles.smallButtonDanger} onClick={removeSelected}>
                  Delete
                </button>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
