"use client";

import Image from "next/image";
import { useRef } from "react";

import { creatorCategories } from "./landingContent.constant";
import { LandingIcon } from "./landingIcons";
import shared from "./landingPage.module.css";
import styles from "./landingCategories.module.css";

export function LandingCategories() {
  const scrollerRef = useRef<HTMLUListElement>(null);

  function scrollByOneCard(direction: 1 | -1) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const firstCard = scroller.firstElementChild as HTMLElement | null;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollBy({ left: direction * ((firstCard?.offsetWidth ?? 300) + 16), behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <section className={`${shared.section} ${styles.section}`} aria-labelledby="categories-heading">
      <div className={`${shared.inner} ${styles.head}`}>
        <div className={shared.intro}>
          <p className={shared.eyebrow}>For every kind of creator</p>
          <h2 id="categories-heading" className={shared.heading}>
            Whatever you make, there is a stage for it.
          </h2>
        </div>
        <div className={styles.controls}>
          <button type="button" className={styles.controlButton} onClick={() => scrollByOneCard(-1)} aria-label="Previous creator types">
            <LandingIcon name="chevronLeft" size={20} strokeWidth={2.2} />
          </button>
          <button type="button" className={styles.controlButton} onClick={() => scrollByOneCard(1)} aria-label="Next creator types">
            <LandingIcon name="chevronRight" size={20} strokeWidth={2.2} />
          </button>
        </div>
      </div>
      <ul ref={scrollerRef} className={styles.scroller} aria-label="Creator types" tabIndex={0}>
        {creatorCategories.map((category) => (
          <li key={category.title} className={styles.card}>
            <Image src={category.image} alt={category.imageAlt} fill sizes="(max-width: 600px) 78vw, 340px" className={styles.photo} />
            <div className={styles.cardText}>
              <span className={styles.cardIcon}>
                <LandingIcon name={category.icon} size={18} />
              </span>
              <h3 className={styles.cardTitle}>{category.title}</h3>
              <p className={styles.cardDescription}>{category.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
