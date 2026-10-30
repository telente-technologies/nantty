import { NotFoundScreen } from "@nantty/web-kit";

import recoveryStyles from "@/components/errors/errorPage.module.css";

export default function ProfileNotFound() {
  return <div className={recoveryStyles.experience}><NotFoundScreen kind="contentGone" subject="profile" /></div>;
}
