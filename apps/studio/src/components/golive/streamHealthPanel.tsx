"use client";

import type { ComponentType } from "react";

import { ErrorState } from "@/components/ui/feedback";
import { SignalFairIcon, SignalLostIcon, SignalStrongIcon, SignalWeakIcon, type IconProps } from "@/components/ui/icons";
import { describeQuality, type ConnectionQuality, type PublisherStats } from "@/live/whipPublisher";
import type { StreamHealth } from "@/types/studioLive.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

import styles from "./goLive.module.css";

const INGRESS_LABELS: Record<string, string> = {
  inactive: "Waiting for your stream",
  buffering: "Receiving, buffering",
  publishing: "Receiving your stream",
  error: "Stream error",
  complete: "Stream stopped",
  unknown: "Can't check right now",
};

const QUALITY: Record<ConnectionQuality, { readonly label: string; readonly icon: ComponentType<IconProps>; readonly tone: string }> = {
  excellent: { label: "Excellent", icon: SignalStrongIcon, tone: "good" },
  good: { label: "Good", icon: SignalFairIcon, tone: "good" },
  poor: { label: "Poor: lower your resolution or move closer to Wi-Fi", icon: SignalWeakIcon, tone: "warn" },
  lost: { label: "Connection lost", icon: SignalLostIcon, tone: "bad" },
  connecting: { label: "Connecting", icon: SignalWeakIcon, tone: "neutral" },
};

function readQuality(health: StreamHealth | undefined, local: PublisherStats | null): ConnectionQuality | null {
  if (local) return local.quality;
  const ingress = health?.ingress;
  if (!ingress || ingress.status === "inactive" || ingress.status === "complete" || ingress.status === "unknown") return null;
  if (ingress.status === "error") return "lost";
  if (ingress.status === "buffering") return "connecting";
  const bitrate = (ingress.videoBitrateKbps ?? 0) + (ingress.audioBitrateKbps ?? 0);
  return describeQuality({ bitrateKbps: bitrate || null, packetLossPercent: null, roundTripMs: null });
}

const formatBitrate = (kbps: number | null) => (kbps === null ? "—" : kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`);

interface StreamHealthPanelProps {
  readonly health: StreamHealth | undefined;
  readonly error: unknown;
  readonly local: PublisherStats | null;
  readonly onRetry: () => void;
}

export function StreamHealthPanel({ health, error, local, onRetry }: StreamHealthPanelProps) {
  if (error && !health) return <ErrorState title="Stream health didn't load" error={error} onRetry={onRetry} />;
  const ingress = health?.ingress ?? null;
  const receiving = ingress?.status === "publishing" || (local !== null && local.quality !== "lost" && local.quality !== "connecting");
  const onAir = health?.state === "live" && receiving;
  const quality = readQuality(health, local);
  const qualityInfo = quality ? QUALITY[quality] : null;
  const QualityIcon = qualityInfo?.icon;
  const bitrate = local?.bitrateKbps ?? (ingress && ingress.videoBitrateKbps !== null ? ingress.videoBitrateKbps + (ingress.audioBitrateKbps ?? 0) : null);
  const width = local?.width ?? ingress?.width ?? null;
  const height = local?.height ?? ingress?.height ?? null;
  const fps = local?.framesPerSecond ?? ingress?.framerate ?? null;

  const airLabel = onAir ? "On air" : health?.state === "live" ? "Live, but no video is arriving" : health?.state === "ended" ? "Ended" : "Off air";

  return (
    <section className={styles.healthPanel} aria-label="Stream health">
      <div className={styles.healthStatus} role="status" aria-live="polite">
        <span className={onAir ? styles.airDotOn : styles.airDot} aria-hidden="true" />
        <strong>{airLabel}</strong>
      </div>
      <dl className={styles.healthGrid}>
        <div>
          <dt>Watching now</dt>
          <dd>{health ? formatCountWithThousandsSuffix(health.viewers) : "…"}</dd>
        </div>
        <div>
          <dt>Peak</dt>
          <dd>{health ? formatCountWithThousandsSuffix(health.peakViewers) : "…"}</dd>
        </div>
        <div>
          <dt>Connection</dt>
          <dd className={qualityInfo ? styles[`quality_${qualityInfo.tone}`] : undefined}>
            {QualityIcon ? <QualityIcon size={16} /> : null}
            {qualityInfo ? qualityInfo.label : "—"}
          </dd>
        </div>
        <div>
          <dt>Bitrate</dt>
          <dd>{formatBitrate(bitrate)}</dd>
        </div>
        <div>
          <dt>Video</dt>
          <dd>{width && height ? `${width}×${height}${fps ? ` · ${Math.round(fps)} fps` : ""}` : "—"}</dd>
        </div>
        <div>
          <dt>Ingest</dt>
          <dd>{local ? "Browser" : ingress ? `${ingress.protocol.toUpperCase()} · ${INGRESS_LABELS[ingress.status] ?? ingress.status}` : "No stream key yet"}</dd>
        </div>
      </dl>
      {ingress?.error ? <p className={styles.alert} role="alert">{ingress.error}</p> : null}
    </section>
  );
}
