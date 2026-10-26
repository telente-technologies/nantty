"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import { socialShoppingFeatures } from "./socialShoppingFeatures.content";
import styles from "./socialShoppingSection.module.css";

export function SocialShoppingFeatureTabsSection() {
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0);
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedFeature = socialShoppingFeatures[selectedFeatureIndex] ?? socialShoppingFeatures[0];

  function moveTabSelectionWithArrowKeys(event: KeyboardEvent<HTMLDivElement>) {
    const featureCount = socialShoppingFeatures.length;
    const keyToIndexChange: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let nextFeatureIndex: number | null = null;
    if (event.key in keyToIndexChange) nextFeatureIndex = (selectedFeatureIndex + (keyToIndexChange[event.key] ?? 0) + featureCount) % featureCount;
    if (event.key === "Home") nextFeatureIndex = 0;
    if (event.key === "End") nextFeatureIndex = featureCount - 1;
    if (nextFeatureIndex === null) return;
    event.preventDefault();
    setSelectedFeatureIndex(nextFeatureIndex);
    tabButtonRefs.current[nextFeatureIndex]?.focus();
  }

  return (
    <section id="social-shopping" className={styles.section} aria-labelledby="social-shopping-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.copyColumn}>
          <SectionIntroWithEyebrowAndHeading
            eyebrow="Social Commerce"
            headingId="social-shopping-heading"
            heading="Watch it, ask about it, buy it. Same app."
            description="Nantty puts the way Nigerians already shop online, through posts, videos and DMs, next to a proper cart and checkout."
          />
          <div className={styles.tabList} role="tablist" aria-label="Ways to shop" aria-orientation="vertical" onKeyDown={moveTabSelectionWithArrowKeys}>
            {socialShoppingFeatures.map((feature, featureIndex) => {
              const isSelected = featureIndex === selectedFeatureIndex;
              return (
                <button
                  key={feature.id}
                  ref={(buttonElement) => {
                    tabButtonRefs.current[featureIndex] = buttonElement;
                  }}
                  id={`feature-tab-${feature.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="feature-panel"
                  tabIndex={isSelected ? 0 : -1}
                  className={styles.tab}
                  onClick={() => setSelectedFeatureIndex(featureIndex)}
                >
                  <span className={styles.tabIcon}>
                    <FigmaIconTintedWithCurrentColor name={feature.icon} size={22} />
                  </span>
                  <span className={styles.tabText}>
                    <span className={styles.tabLabel}>{feature.tabLabel}</span>
                    <span className={styles.tabHeadline}>{feature.headline}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div id="feature-panel" role="tabpanel" aria-labelledby={`feature-tab-${selectedFeature.id}`} className={styles.panel} tabIndex={0}>
          <div className={styles.phoneBackdrop} aria-hidden="true" />
          <PhoneFrameWithAppScreen key={selectedFeature.id} screen={selectedFeature.screen} alt={selectedFeature.screenAlt} className={styles.phone} sizes="(min-width: 960px) 320px, 70vw" />
          <p className={styles.panelDescription}>{selectedFeature.description}</p>
        </div>
      </div>
    </section>
  );
}
