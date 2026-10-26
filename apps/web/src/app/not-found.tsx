import type { Metadata } from "next";
import { NotFoundScreen } from "@nantty/web-kit";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function PageNotFound() {
  return <NotFoundScreen description="The link may be old or have a typo. The shops are this way." />;
}
