"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";

import { LandingIcon, type LandingIconName } from "./landingIcons";
import shared from "./landingPage.module.css";
import styles from "./landingGoLiveModes.module.css";
import { GuestStageVisual, ObsControlRoomVisual, PhoneLiveVisual } from "./goLiveModeVisuals";

interface GoLiveMode {
  readonly id: "phone" | "encoder" | "guests";
  readonly title: string;
  readonly description: string;
  readonly icon: LandingIconName;
}

const goLiveModes: readonly GoLiveMode[] = [
  { id: "phone", title: "Your phone", description: "Tap Go live in the app. Flip the camera, share your screen while you play and read comments as they land.", icon: "phone" },
  { id: "encoder", title: "OBS, WHIP or any encoder", description: "Copy the server URL and stream key from your control room. Add your overlay as a browser source and you are on air.", icon: "monitor" },
  { id: "guests", title: "Up to 10 on stage", description: "Bring fans and other creators into your live. Start a battle, mute a guest or hand over the stage.", icon: "users" },
];

export function LandingGoLiveModes() {
  const [activeModeId, setActiveModeId] = useState<GoLiveMode["id"]>("phone");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function moveFocusWithArrowKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offset = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    const nextIndex = (index + offset + goLiveModes.length) % goLiveModes.length;
    const nextMode = goLiveModes[nextIndex];
    if (!nextMode) return;
    setActiveModeId(nextMode.id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section id="go-live" className={shared.section} aria-labelledby="go-live-heading">
      <div className={`${shared.inner} ${styles.layout}`}>
        <div className={styles.copy}>
          <div className={shared.intro}>
            <p className={shared.eyebrow}>Go live your way</p>
            <h2 id="go-live-heading" className={shared.heading}>
              On air in seconds, from any setup.
            </h2>
            <p className={shared.lede}>Start on your phone tonight and move to a full OBS scene when you are ready. Your audience, gifts and earnings follow you either way.</p>
          </div>
          <div role="tablist" aria-label="Ways to go live" aria-orientation="vertical" className={styles.tabList}>
            {goLiveModes.map((mode, index) => {
              const isActive = mode.id === activeModeId;
              return (
                <button
                  key={mode.id}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  type="button"
                  role="tab"
                  id={`go-live-tab-${mode.id}`}
                  aria-selected={isActive}
                  aria-controls={`go-live-panel-${mode.id}`}
                  tabIndex={isActive ? 0 : -1}
                  className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                  onClick={() => setActiveModeId(mode.id)}
                  onKeyDown={(event) => moveFocusWithArrowKeys(event, index)}
                >
                  <span className={styles.tabIcon}>
                    <LandingIcon name={mode.icon} size={20} />
                  </span>
                  <span className={styles.tabText}>
                    <span className={styles.tabTitle}>{mode.title}</span>
                    <span className={styles.tabDescription}>{mode.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <Link href="/login" className={shared.primaryAction}>
            Open your control room
          </Link>
        </div>
        <div className={styles.visualPanel}>
          {goLiveModes.map((mode) => (
            <div key={mode.id} role="tabpanel" id={`go-live-panel-${mode.id}`} aria-labelledby={`go-live-tab-${mode.id}`} hidden={mode.id !== activeModeId} className={styles.panel}>
              {mode.id === "phone" ? <PhoneLiveVisual /> : mode.id === "encoder" ? <ObsControlRoomVisual /> : <GuestStageVisual />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
