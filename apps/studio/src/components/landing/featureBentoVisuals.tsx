import Image from "next/image";

import { LandingIcon, type LandingIconName } from "./landingIcons";
import baseStyles from "./featureBentoVisuals.module.css";
import partStyles from "./featureBentoVisualsParts.module.css";

const styles = { ...baseStyles, ...partStyles };

const giftTray: readonly { name: string; coins: string; icon: LandingIconName }[] = [
  { name: "Heart", coins: "1 coin", icon: "heart" },
  { name: "Star", coins: "10 coins", icon: "star" },
  { name: "Talking Drum", coins: "99 coins", icon: "drum" },
  { name: "Crown", coins: "499 coins", icon: "crown" },
];

export function GiftsVisual() {
  return (
    <div className={styles.giftsLayout}>
      <ul className={styles.giftTray} aria-label="Example gifts">
        {giftTray.map((gift) => (
          <li key={gift.name} className={styles.giftTile}>
            <span className={styles.giftGlyph}>
              <LandingIcon name={gift.icon} size={22} />
            </span>
            <span className={styles.giftName}>{gift.name}</span>
            <span className={styles.giftCoins}>{gift.coins}</span>
          </li>
        ))}
      </ul>
      <div className={styles.giftFeed}>
        <p className={styles.comboToast}>
          <span className={styles.comboAvatar} aria-hidden="true">
            K
          </span>
          <span>
            <strong>Kemi</strong> sent Talking Drum
          </span>
          <span className={styles.comboCount}>x12</span>
        </p>
        <div className={styles.goalCard}>
          <p className={styles.goalRow}>
            <span>Gift goal: new ring light</span>
            <span className={styles.mono}>74%</span>
          </p>
          <span className={styles.goalTrack} aria-hidden="true">
            <span className={styles.goalFill} />
          </span>
        </div>
      </div>
    </div>
  );
}

export function BattleVisual() {
  return (
    <div className={styles.battleCard}>
      <div className={styles.versus}>
        <span className={styles.vsAvatar}>
          <Image src="/photos/creatorMicPortrait.webp" alt="" fill sizes="48px" className={styles.cover} />
        </span>
        <span className={styles.vsLabel}>VS</span>
        <span className={`${styles.vsAvatar} ${styles.vsYellow}`}>
          <Image src="/photos/podcastDeskHost.webp" alt="" fill sizes="48px" className={styles.cover} />
        </span>
      </div>
      <div className={styles.miniScore} role="img" aria-label="Score 8,420 to 6,110">
        <span className={styles.miniBlue}>8,420</span>
        <span className={styles.miniYellow}>6,110</span>
      </div>
      <p className={styles.switchRow}>
        Winner takes all
        <span className={styles.switch} aria-hidden="true" />
      </p>
    </div>
  );
}

export function OverlayVisual() {
  return (
    <div className={styles.screenFrame}>
      <Image src="/screens/studioOverlayEditor.webp" alt="The Studio overlay editor with layers for a logo plate and a lower third" width={1440} height={840} sizes="(max-width: 700px) 90vw, 360px" className={styles.screenshot} />
    </div>
  );
}

const moderationComments = [
  { name: "seyi", text: "This set is too clean", state: "shown" },
  { name: "anon_44", text: "Message held: blocked word", state: "held" },
  { name: "amaka", text: "Play the slow one next", state: "shown" },
] as const;

export function ModerationVisual() {
  return (
    <div className={styles.panelCard}>
      <p className={styles.panelHead}>
        <span>Live comments</span>
        <span className={styles.chip}>Slow mode 5s</span>
      </p>
      <ul className={styles.commentList}>
        {moderationComments.map((comment) => (
          <li key={comment.name} className={comment.state === "held" ? styles.heldComment : styles.commentRow}>
            <strong>{comment.name}</strong>
            <span>{comment.text}</span>
            {comment.state === "held" ? (
              <span className={styles.heldActions} aria-hidden="true">
                <span>Allow</span>
                <span>Remove</span>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const leaderboard = [
  { rank: 1, name: "Kemi", points: "42,180" },
  { rank: 2, name: "Chidi", points: "31,560" },
  { rank: 3, name: "Bola", points: "18,920" },
];

export function LeaderboardVisual() {
  return (
    <ol className={styles.panelCard} aria-label="Example leaderboard">
      {leaderboard.map((fan) => (
        <li key={fan.rank} className={styles.leaderRow}>
          <span className={fan.rank === 1 ? styles.rankGold : styles.rank}>{fan.rank === 1 ? <LandingIcon name="crown" size={14} strokeWidth={2.2} /> : fan.rank}</span>
          <span className={styles.leaderName}>{fan.name}</span>
          <span className={styles.mono}>{fan.points} pts</span>
        </li>
      ))}
    </ol>
  );
}

const replays = [
  { title: "Friday freestyle", length: "1:42:10", image: "/photos/singerLiveMic.webp" },
  { title: "Squad night: finals", length: "2:05:33", image: "/photos/couchGamerControllers.webp" },
];

export function RecordingsVisual() {
  return (
    <ul className={styles.panelCard}>
      {replays.map((replay) => (
        <li key={replay.title} className={styles.replayRow}>
          <span className={styles.replayThumb}>
            <Image src={replay.image} alt="" fill sizes="72px" className={styles.cover} />
            <LandingIcon name="film" size={14} className={styles.replayIcon} />
          </span>
          <span className={styles.replayText}>
            <strong>{replay.title}</strong>
            <span className={styles.mono}>{replay.length}</span>
          </span>
          <span className={styles.chip}>Replay</span>
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsVisual() {
  return (
    <div className={styles.panelCard}>
      <p className={styles.panelHead}>
        <span>Viewers</span>
        <span className={styles.mono}>Peak 2,140</span>
      </p>
      <svg viewBox="0 0 240 72" className={styles.sparkline} role="img" aria-label="Viewer count rising to a peak of 2,140 during the live">
        <path d="M0 64 L24 58 L48 60 L72 44 L96 48 L120 30 L144 34 L168 14 L192 20 L216 26 L240 22 L240 72 L0 72 Z" className={styles.sparkArea} />
        <path d="M0 64 L24 58 L48 60 L72 44 L96 48 L120 30 L144 34 L168 14 L192 20 L216 26 L240 22" className={styles.sparkLine} />
        <circle cx="168" cy="14" r="4" className={styles.sparkPeak} />
      </svg>
      <p className={styles.statRow}>
        <span>
          Watch time <strong>412 h</strong>
        </span>
        <span>
          New followers <strong>+318</strong>
        </span>
      </p>
    </div>
  );
}

export function CheckmarkVisual() {
  return (
    <div className={styles.profileCard}>
      <span className={styles.profileAvatar}>
        <Image src="/photos/creatorMicPortrait.webp" alt="" fill sizes="56px" className={styles.cover} />
      </span>
      <span className={styles.profileText}>
        <strong className={styles.profileName}>
          Temi Adeyemi
          <svg viewBox="0 0 24 24" width="20" height="20" className={styles.blueCheck} role="img" aria-label="Blue checkmark">
            <path d="M12 2.8 14.3 4.6l2.9-.2.9 2.8 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.8-2.9-.2L12 21.2l-2.3-1.8-2.9.2-.9-2.8-2.4-1.7.9-2.8-.9-2.8 2.4-1.7.9-2.8 2.9.2L12 2.8Z" fill="currentColor" />
            <path d="m8.6 12.2 2.3 2.3 4.5-4.8" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </strong>
        <span className={styles.profileHandle}>@temi.creates · Creator</span>
      </span>
    </div>
  );
}
