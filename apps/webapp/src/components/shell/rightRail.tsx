import { legalLinks } from "@/config/legalLinks.config";

import { CartSummaryModule, SuggestedAccountsModule, TrendingModule, WalletSummaryModule } from "./rightRailModules";
import styles from "./rightRail.module.css";
import type { RightRailModuleName } from "./shellLayout.config";

const railModuleComponents: Record<RightRailModuleName, () => React.ReactNode> = {
  wallet: WalletSummaryModule,
  suggestedAccounts: SuggestedAccountsModule,
  trending: TrendingModule,
  cartSummary: CartSummaryModule,
};

export function RightRail({ modules }: { readonly modules: readonly RightRailModuleName[] }) {
  return (
    <aside className={styles.rail} aria-label="Highlights">
      {modules.map((moduleName) => {
        const RailModule = railModuleComponents[moduleName];
        return <RailModule key={moduleName} />;
      })}
      <footer className={styles.railFooter}>
        <a href={legalLinks.terms} target="_blank" rel="noreferrer">
          Terms
        </a>
        <a href={legalLinks.privacyPolicy} target="_blank" rel="noreferrer">
          Privacy
        </a>
        <a href={legalLinks.cookiePolicy} target="_blank" rel="noreferrer">
          Cookies
        </a>
        <span>© {new Date().getFullYear()} Nantty</span>
      </footer>
    </aside>
  );
}
