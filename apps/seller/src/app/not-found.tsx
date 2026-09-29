import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function NotFoundPage() {
  return (
    <main id="main-content" style={{ minHeight: "70dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <EmptyState iconName="question24" title="We could not find that page" description="It may have moved, or the link is wrong." action={<ButtonLink href="/" variant="primary">Go to your dashboard</ButtonLink>} />
    </main>
  );
}
