import Image from "next/image";

import styles from "./phoneFrame.module.css";

export type AppScreenName =
  | "chatWithSellerScreen"
  | "creatorDashboardScreen"
  | "creatorProfileScreen"
  | "escrowStatusScreen"
  | "homeFeedScreen"
  | "homeMartScreen"
  | "liveShoppingScreen"
  | "martProductsScreen"
  | "productDetailScreen"
  | "sellerDashboardScreen"
  | "sellerWalletScreen"
  | "shoppableClipsScreen"
  | "shoppingCartScreen"
  | "storyScreen";

interface PhoneFrameProps {
  readonly screen: AppScreenName;
  readonly alt: string;
  readonly className?: string;
  readonly priority?: boolean;
}

export function PhoneFrameWithAppScreen({ screen, alt, className, priority = false }: PhoneFrameProps) {
  return (
    <div className={className ? `${styles.phoneBody} ${className}` : styles.phoneBody}>
      <div className={styles.phoneScreen}>
        <Image src={`/screens/${screen}.webp`} alt={alt} width={393} height={852} priority={priority} sizes="(min-width: 900px) 300px, 60vw" className={styles.screenImage} />
      </div>
    </div>
  );
}
