import { CreateAdEntry } from "@/components/ads/createAdEntry";

type SearchParams = Promise<Readonly<Record<string, string | string[] | undefined>>>;

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function CreateAdPage({ searchParams }: { readonly searchParams: SearchParams }) {
  const query = await searchParams;
  return <CreateAdEntry destinationType={firstValue(query.type)} targetId={firstValue(query.target)} fromBoostId={firstValue(query.from)} isResubmission={firstValue(query.resubmit) === "1"} />;
}
