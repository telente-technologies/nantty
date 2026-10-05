import Image from "next/image";

import { LandingIcon, type LandingIconName } from "./landingIcons";
import baseStyles from "./liveStageMockup.module.css";
import partStyles from "./liveStageMockupParts.module.css";

const styles = { ...baseStyles, ...partStyles };

const giftCombos: readonly { sender: string; gift: string; icon: LandingIconName; combo: number }[] = [
  { sender: "Kemi", gift: "Talking Drum", icon: "drum", combo: 12 },
  { sender: "Chidi", gift: "Crown", icon: "crown", combo: 3 },
];

const phoneComments = [
  { name: "ada.styles", text: "Lagos traffic said hello" },
  { name: "bayo", text: "Which market is this?" },
  { name: "tolu_k", text: "Sent you a rose" },
];

export function LiveStageMockup() {
  return (
    <div className={styles.stage}>
      <div className={styles.stagePanel} aria-hidden="true" />

      <figure className={styles.battleFrame}>
        <div className={styles.battleTiles}>
          <div className={styles.tile}>
            <Image src="/photos/creatorMicPortrait.webp" alt="Creator Temi singing into a studio microphone" fill loading="eager" fetchPriority="high" sizes="(max-width: 1000px) 46vw, 300px" className={styles.tilePhoto} />
            <span className={styles.tileName}>Temi</span>
          </div>
          <div className={styles.tile}>
            <Image src="/photos/talkHostStudio.webp" alt="Guest creator Tunde in headphones at his studio microphone" fill loading="eager" sizes="(max-width: 1000px) 46vw, 300px" className={styles.tilePhoto} />
            <span className={styles.tileName}>Tunde</span>
          </div>
        </div>

        <div className={styles.topBar}>
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} aria-hidden="true" />
            Live
          </span>
          <span className={styles.viewerPill}>
            <LandingIcon name="eye" size={14} />
            2.4K
          </span>
          <span className={styles.ruleChip}>
            <LandingIcon name="trophy" size={14} />
            Winner takes all
          </span>
        </div>

        <div className={styles.scoreBar} role="img" aria-label="Battle score: Temi 12,480 coins, Tunde 9,870 coins, 2 minutes 41 seconds left">
          <span className={styles.scoreBlue} aria-hidden="true">
            12,480
          </span>
          <span className={styles.scoreYellow} aria-hidden="true">
            9,870
          </span>
          <span className={styles.timer} aria-hidden="true">
            02:41
          </span>
        </div>

        <ul className={styles.giftStack} aria-label="Gift combos">
          {giftCombos.map((combo, index) => (
            <li key={combo.sender} className={styles.giftToast} style={{ animationDelay: `${index * 1.4}s` }}>
              <span className={styles.giftIcon}>
                <LandingIcon name={combo.icon} size={16} strokeWidth={2} />
              </span>
              <span className={styles.giftText}>
                <strong>{combo.sender}</strong> sent {combo.gift}
              </span>
              <span className={styles.giftCombo} style={{ animationDelay: `${index * 1.4 + 0.3}s` }}>
                x{combo.combo}
              </span>
            </li>
          ))}
        </ul>

        <figcaption className={styles.goal}>
          <span className={styles.goalLabel}>
            <LandingIcon name="gift" size={14} />
            Gift goal: new ring light
          </span>
          <span className={styles.goalCount}>7,420 / 10,000</span>
          <span className={styles.goalTrack} aria-hidden="true">
            <span className={styles.goalFill} />
          </span>
        </figcaption>
      </figure>

      <figure className={styles.phoneFrame}>
        <div className={styles.phoneScreen}>
          <Image src="/photos/irlLagosStreet.webp" alt="An IRL creator streaming from his phone on a Lagos street" fill sizes="(max-width: 1000px) 34vw, 180px" className={styles.tilePhoto} />
          <span className={`${styles.liveBadge} ${styles.phoneBadge}`}>
            <span className={styles.liveDot} aria-hidden="true" />
            Live
          </span>
          <ul className={styles.phoneComments} aria-label="Live comments">
            {phoneComments.map((comment) => (
              <li key={comment.name}>
                <strong>{comment.name}</strong> {comment.text}
              </li>
            ))}
          </ul>
        </div>
      </figure>

      <aside className={styles.earningsCard} aria-label="Example earnings from one live">
        <p className={styles.earningsLabel}>Tonight&apos;s live · example</p>
        <p className={styles.earningsTotal}>₦184,250</p>
        <div className={styles.earningsBar} aria-hidden="true">
          <span className={styles.barGifts} />
          <span className={styles.barSubs} />
          <span className={styles.barAds} />
        </div>
        <ul className={styles.earningsLegend}>
          <li>
            <span className={styles.dotGifts} aria-hidden="true" />
            Gifts
          </li>
          <li>
            <span className={styles.dotSubs} aria-hidden="true" />
            Subscriptions
          </li>
          <li>
            <span className={styles.dotAds} aria-hidden="true" />
            Ads
          </li>
        </ul>
      </aside>
    </div>
  );
}
