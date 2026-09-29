import type { Metadata } from "next";

import { EmptyFieldErrorScene } from "@/components/errors/emptyFieldErrorScene";
import { ActionLinkStyledAsButton } from "@/components/ui/actionLink";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function PageNotFound() {
  return (
    <EmptyFieldErrorScene
      statusCode="404"
      heading="Nothing on sale out here."
      description="The page you tried to open doesn't exist. The link may be old or have a typo. The shops are this way."
      actions={
        <>
          <ActionLinkStyledAsButton href="/" appearance="onDark">
            Back to the homepage
          </ActionLinkStyledAsButton>
          <ActionLinkStyledAsButton href="/sellers" appearance="secondary">
            Sell on Zudomart
          </ActionLinkStyledAsButton>
        </>
      }
    />
  );
}
