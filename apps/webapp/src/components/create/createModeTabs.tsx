import Link from "next/link";

import styles from "./composer.module.css";

export type CreateModeTab = "post" | "clip" | "story" | "live" | "space";

const CREATE_MODES: readonly { readonly mode: CreateModeTab; readonly label: string; readonly href: string }[] = [
  { mode: "post", label: "Post", href: "/post/new" },
  { mode: "clip", label: "Clip", href: "/create/clip" },
  { mode: "story", label: "Story", href: "/create/story" },
  { mode: "live", label: "Live", href: "/create/live" },
  { mode: "space", label: "Space", href: "/create/space" },
];

export function CreateModeTabs({ active }: { readonly active: CreateModeTab }) {
  return (
    <nav className={styles.modeTabs} aria-label="What do you want to create?">
      {CREATE_MODES.map((entry) => (
        <Link key={entry.mode} href={entry.href} replace className={styles.modeTab} aria-current={entry.mode === active ? "page" : undefined}>
          {entry.label}
        </Link>
      ))}
    </nav>
  );
}
