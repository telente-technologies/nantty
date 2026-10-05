"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { ControlRoomSkeleton } from "@/components/ui/pageSkeletons";
import { RetryButton } from "@/components/ui/controls";
import { readPublicSiteUrl } from "@/config/studioEnvironment.config";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { livesService } from "@/services/lives.service";
import type { OverlayLayer, OverlayLayerType } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { OverlayCanvas } from "./overlayCanvas";
import { OverlayInspector } from "./overlayInspector";
import { ADDABLE, buildLayer } from "./overlayLayers.util";
import partStyles from "./editorParts.module.css";
import baseStyles from "./page.module.css";

const styles = { ...baseStyles, ...partStyles };

export default function OverlayEditorPage({ params }: { readonly params: Promise<{ readonly liveId: string }> }) {
  const { liveId } = use(params);
  const queryClient = useQueryClient();
  const scene = useQuery({ queryKey: ["overlay-scene", liveId], queryFn: () => livesService.fetchOverlays(liveId) });
  const [isSaving, setIsSaving] = useState(false);

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
    if (!scene.data) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const updatedScene = await livesService.saveOverlays(liveId, { name: scene.data.name ?? "Main scene", layers });
      queryClient.setQueryData(["overlay-scene", liveId], updatedScene);
      setDirty(false);
      setSaved(true);
    } catch (error) {
      setSaveError(readErrorMessageForDisplay(error));
    } finally {
      setIsSaving(false);
    }
  }

  function discardChanges() {
    setSelectedId(null);
    setSaveError(null);
    setDirty(false);
  }

  if (scene.isLoading) return <ControlRoomSkeleton label="Loading overlay" />;
  if (scene.isError || !scene.data) {
    return <ErrorState title="We couldn't load this overlay" description={readErrorMessageForDisplay(scene.error)} action={<RetryButton onRetry={() => scene.refetch()} />} />;
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
          <Button variant="secondary" onClick={discardChanges} disabled={!dirty || isSaving}>
            Discard changes
          </Button>
          <Button busy={isSaving} onClick={save} disabled={!dirty}>
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
        <OverlayCanvas layers={layers} selectedId={selectedId} overlayUrl={overlayUrl} onSelect={setSelectedId} />

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

          {selected ? <OverlayInspector selected={selected} onPatch={patchSelected} onMove={moveSelected} onRemove={removeSelected} /> : null}
        </aside>
      </div>
    </div>
  );
}
