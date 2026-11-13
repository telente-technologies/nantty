"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export type HomeSection = "feed" | "mart";

interface HomeSectionContextValue {
  readonly activeSection: HomeSection;
  readonly selectSection: (section: HomeSection) => void;
}

const HomeSectionContext = createContext<HomeSectionContextValue | null>(null);

function sectionFromLocation(): HomeSection {
  return new URLSearchParams(window.location.search).get("section") === "mart" ? "mart" : "feed";
}

function writeSectionToLocation(section: HomeSection) {
  const url = new URL(window.location.href);
  if (section === "mart") url.searchParams.set("section", "mart");
  else url.searchParams.delete("section");
  window.history.replaceState(window.history.state, "", url);
}

export function HomeSectionProvider({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState<HomeSection>("feed");
  const scrollPositions = useRef<Record<HomeSection, number>>({ feed: 0, mart: 0 });

  useEffect(() => {
    if (pathname === "/") setActiveSection(sectionFromLocation());
  }, [pathname]);

  const selectSection = useCallback((section: HomeSection) => {
    setActiveSection((current) => {
      if (current !== section) {
        scrollPositions.current[current] = window.scrollY;
        requestAnimationFrame(() => window.scrollTo({ top: scrollPositions.current[section] }));
      }
      return section;
    });
    if (pathname === "/") writeSectionToLocation(section);
  }, [pathname]);

  return <HomeSectionContext.Provider value={{ activeSection, selectSection }}>{children}</HomeSectionContext.Provider>;
}

export function useHomeSection() {
  const value = useContext(HomeSectionContext);
  if (!value) throw new Error("useHomeSection must be used inside HomeSectionProvider");
  return value;
}
