"use client";

import { createDraftKey, type VideoDraft } from "@/components/catalog/productEditorDraft.util";
import { Button, IconButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { maximumProductVideos } from "@/utils/productValidation.util";

import styles from "./productEditor.module.css";

export function ProductVideosSection({ videos, fieldErrors, onVideosChange }: { readonly videos: VideoDraft[]; readonly fieldErrors: Record<string, string>; readonly onVideosChange: (videos: VideoDraft[]) => void }) {
  const updateVideo = (key: string, patch: Partial<VideoDraft>) => onVideosChange(videos.map((video) => (video.key === key ? { ...video, ...patch } : video)));
  return (
    <Panel
      title="Videos"
      description="Link up to 3 videos, such as a clip you posted in the Nantty app or an MP4 on your site."
      actions={videos.length < maximumProductVideos ? <Button size="small" iconName="videoCamera24" onClick={() => onVideosChange([...videos, { key: createDraftKey(), url: "", title: "" }])}>Add video</Button> : null}
    >
      {videos.length === 0 ? <p className={styles.muted}>No videos yet. Products with a short video tend to sell faster.</p> : null}
      <ul className={styles.attributeList}>
        {videos.map((video, index) => (
          <li key={video.key} className={styles.videoRow}>
            <input className={styles.cellInput} type="url" inputMode="url" aria-label={`Video ${index + 1} link`} placeholder="https://" value={video.url} maxLength={500} aria-invalid={fieldErrors[`videos.${index}.url`] ? true : undefined} onChange={(event) => updateVideo(video.key, { url: event.target.value })} />
            <input className={styles.cellInput} aria-label={`Video ${index + 1} title`} placeholder="Title (optional)" value={video.title} maxLength={80} onChange={(event) => updateVideo(video.key, { title: event.target.value })} />
            <IconButton iconName="trash24" label={`Remove video ${index + 1}`} size="small" onClick={() => onVideosChange(videos.filter((candidate) => candidate.key !== video.key))} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
