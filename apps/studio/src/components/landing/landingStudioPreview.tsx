import styles from "./landingStudioPreview.module.css";

export function LandingStudioPreview({ title = "Creator control room" }: { readonly title?: string }) {
  return (
    <div className={styles.preview} role="img" aria-label={`${title} preview for Nantty Studio`}>
      <div className={styles.header}><span className={styles.mark}>N</span><strong>Nantty Studio</strong><span className={styles.live}>READY</span></div>
      <div className={styles.body}><p>YOUR CREATOR WORKSPACE</p><h4>{title}</h4><div className={styles.stage}><span className={styles.play}>▶</span><span>Stream preview</span></div><div className={styles.controls}><span>Stream setup</span><span>Overlays</span><span>Audience</span></div></div>
    </div>
  );
}
