import Image from "next/image";

import styles from "./phoneFrame.module.css";

export type AppScreenName =
  | "chatWithSellerScreen" | "creatorProfileScreen" | "homeFeedScreen" | "homeMartScreen"
  | "liveShoppingScreen" | "onboardingScreen" | "paymentMethodsScreen" | "productDetailScreen"
  | "shoppableClipsScreen" | "shoppingCartScreen" | "storyScreen";

interface PhoneFrameProps {
  readonly screen: AppScreenName;
  readonly alt: string;
  readonly className?: string;
  readonly priority?: boolean;
  readonly sizes?: string;
}

export function PhoneFrameWithAppScreen({ screen, alt, className, priority = false, sizes = "(min-width: 900px) 300px, 60vw" }: PhoneFrameProps) {
  return (
    <div className={className ? `${styles.phoneBody} ${className}` : styles.phoneBody}>
      <div className={styles.phoneScreen}>
        <Image src={`/screens/${screen}.png`} alt={alt} width={393} height={852} priority={priority} sizes={sizes} className={styles.screenImage} />
      </div>
    </div>
  );
}
