import { Spaces } from "@/components/spaces/spaces";
import { CreateModeTabs } from "@/components/create/createModeTabs";
export default function CreateSpacePage() {
  return (
    <>
      <CreateModeTabs active="space" />
      <Spaces creating />
    </>
  );
}
