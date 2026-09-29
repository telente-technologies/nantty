import type { Metadata } from "next";

import { CreateAdAccountForm } from "@/components/accounts/createAdAccountForm";
import { StandaloneFrame } from "@/components/shell/standaloneFrame";

export const metadata: Metadata = { title: "New ad account" };

export default function NewAdAccountPage() {
  return (
    <StandaloneFrame width="narrow">
      <CreateAdAccountForm />
    </StandaloneFrame>
  );
}
