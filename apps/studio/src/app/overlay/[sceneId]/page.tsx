"use client";

import { use } from "react";

import { livesService, type OverlayScenePayload } from "@/services/lives.service";
import type { OverlayLayer } from "@/types";
import { useQuery } from "@tanstack/react-query";

import styles from "./page.module.css";

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

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

export default function OverlayBrowserSourcePage({ params }: { readonly params: Promise<{ readonly sceneId: string }> }) {
  const { sceneId } = use(params);
  const payload = useQuery<OverlayScenePayload>({
    queryKey: ["overlay-browser-source", sceneId],
    queryFn: () => livesService.fetchOverlayScene(sceneId),
    refetchInterval: 4000,
  });

  const layers = payload.data?.scene.layers ?? [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: "html,body{margin:0;padding:0;background:transparent;overflow:hidden}" }} />
      <main className={styles.canvas} aria-label="Overlay layer">
        {layers.map((layer) => (
          <div key={layer.id} className={styles.layer} style={layerStyle(layer)}>
            {layer.type === "shape" ? null : layer.type === "image" ? (
              layer.src ? <img src={layer.src} alt="" className={styles.layerImage} /> : null
            ) : (
              layer.text
            )}
          </div>
        ))}
      </main>
    </>
  );
}
