import { Spaces } from "@/components/spaces/spaces";
export default async function SpacePage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  return <Spaces spaceId={spaceId} />;
}
