import Image from "next/image";

import { LandingIcon } from "./landingIcons";
import styles from "./goLiveModeVisuals.module.css";

export function PhoneLiveVisual() {
  return (
    <figure className={styles.phoneScene}>
      <div className={styles.phone}>
        <div className={styles.phoneScreen}>
          <Image src="/photos/singerLiveMic.webp" alt="A singer performing live from his phone" fill sizes="(max-width: 900px) 60vw, 300px" className={styles.cover} />
          <div className={styles.phoneTop}>
            <span className={styles.liveBadge}>Live</span>
            <span className={styles.darkPill}>
              <LandingIcon name="eye" size={12} />
              864
            </span>
          </div>
          <div className={styles.phoneControls} aria-hidden="true">
            <span>
              <LandingIcon name="rotate" size={16} />
            </span>
            <span>
              <LandingIcon name="monitor" size={16} />
            </span>
            <span>
              <LandingIcon name="users" size={16} />
            </span>
          </div>
          <div className={styles.phoneBottom}>
            <p className={styles.comment}>
              <strong>ife</strong> Sing the second verse again
            </p>
            <p className={styles.comment}>
              <strong>femi.o</strong> sent a Rose x5
            </p>
          </div>
        </div>
      </div>
      <figcaption className={styles.floatingChip}>
        <LandingIcon name="wifi" size={16} />
        Adapts to your network so the live keeps going
      </figcaption>
    </figure>
  );
}

export function ObsControlRoomVisual() {
  return (
    <figure className={styles.browserScene}>
      <div className={styles.browser}>
        <div className={styles.browserBar} aria-hidden="true">
          <span />
          <span />
          <span />
          <p>studio.nantty.com</p>
        </div>
        <Image src="/screens/studioControlRoom.webp" alt="The Studio control room: server URL, stream key, overlay browser source, coins earned, gifts and top gifters" width={1440} height={880} sizes="(max-width: 900px) 92vw, 600px" className={styles.screenshot} />
      </div>
      <figcaption className={styles.keyCard}>
        <span className={styles.keyLabel}>Server URL</span>
        <code>rtmp://studio.nantty.com/live</code>
        <span className={styles.keyLabel}>Stream key</span>
        <code>••••••••••••••••</code>
      </figcaption>
    </figure>
  );
}

const guestTiles = [
  { src: "/photos/creatorMicPortrait.webp", name: "Temi", alt: "Host Temi at her microphone" },
  { src: "/photos/podcastDeskHost.webp", name: "Dami", alt: "Guest Dami in headphones at his desk" },
  { src: "/photos/talkHostStudio.webp", name: "Tunde", alt: "Guest Tunde in his home studio" },
  { src: "/photos/musicConcertNeon.webp", name: "Zara", alt: "Guest Zara on stage" },
  { src: "/photos/singerLiveMic.webp", name: "Kofi", alt: "Guest Kofi singing" },
];

export function GuestStageVisual() {
  return (
    <figure className={styles.guestScene}>
      <div className={styles.guestGrid}>
        {guestTiles.map((tile, index) => (
          <div key={tile.name} className={`${styles.guestTile} ${index === 0 ? styles.hostTile : ""}`}>
            <Image src={tile.src} alt={tile.alt} fill sizes="(max-width: 900px) 30vw, 200px" className={styles.cover} />
            <span className={styles.guestName}>
              {index === 0 ? <LandingIcon name="crown" size={12} /> : <LandingIcon name="mic" size={12} />}
              {tile.name}
            </span>
          </div>
        ))}
        <div className={styles.openSeat}>
          <LandingIcon name="plus" size={22} />
          <span>5 seats open</span>
        </div>
      </div>
      <figcaption className={styles.floatingChip}>
        <LandingIcon name="users" size={16} />
        Host plus 9 guests on one stage
      </figcaption>
    </figure>
  );
}
