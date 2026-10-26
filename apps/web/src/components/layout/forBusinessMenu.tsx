"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { businessAppLinks } from "@/lib/siteConfig.config";

import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import styles from "./forBusinessMenu.module.css";

export function ForBusinessDisclosureMenu() {
  const currentPathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelId = useId();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [currentPathname]);

  useEffect(() => {
    if (!isMenuOpen) return;
    function closeMenuWhenPointerLandsOutside(event: PointerEvent) {
      if (menuContainerRef.current?.contains(event.target as Node)) return;
      setIsMenuOpen(false);
    }
    function closeMenuOnEscapeKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      toggleButtonRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeMenuWhenPointerLandsOutside);
    document.addEventListener("keydown", closeMenuOnEscapeKey);
    return () => {
      document.removeEventListener("pointerdown", closeMenuWhenPointerLandsOutside);
      document.removeEventListener("keydown", closeMenuOnEscapeKey);
    };
  }, [isMenuOpen]);

  return (
    <div ref={menuContainerRef} className={styles.menuContainer}>
      <button
        ref={toggleButtonRef}
        type="button"
        className={styles.toggleButton}
        aria-expanded={isMenuOpen}
        aria-controls={menuPanelId}
        onClick={() => setIsMenuOpen((wasOpen) => !wasOpen)}
      >
        For business
        <FigmaIconTintedWithCurrentColor name="caretDown24" size={16} className={styles.caret} />
      </button>
      <div id={menuPanelId} className={styles.panel} hidden={!isMenuOpen}>
        <Link href="/sellers" className={styles.panelLink} aria-current={currentPathname === "/sellers" ? "page" : undefined}>
          <FigmaIconTintedWithCurrentColor name="buildingStore20" size={20} className={styles.panelIcon} />
          <span>
            <strong>Sell on Nantty</strong>
            <small>Open a store in the app, sell through posts, clips and lives.</small>
          </span>
        </Link>
        {[businessAppLinks.sellerDashboard, businessAppLinks.adsManager].map((businessAppLink, linkIndex) => (
          <a key={businessAppLink.href} href={businessAppLink.href} className={styles.panelLink} target="_blank" rel="noopener noreferrer">
            <FigmaIconTintedWithCurrentColor name={linkIndex === 0 ? "speedometer24" : "tag24"} size={20} className={styles.panelIcon} />
            <span>
              <strong>
                {businessAppLink.label}
                <FigmaIconTintedWithCurrentColor name="arrowUpRight24" size={14} className={styles.externalIcon} />
              </strong>
              <small>{businessAppLink.description}</small>
            </span>
            <span className="visuallyHidden">(opens in a new tab)</span>
          </a>
        ))}
      </div>
    </div>
  );
}
