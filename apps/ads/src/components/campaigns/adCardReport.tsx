"use client";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { Card } from "@/components/ui/surfaces";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { campaignsApi } from "@/services/campaignsApi.service";
import type { Ad } from "@/types/campaign.type";
import { formatCompactCount } from "@/utils/numberFormatting.util";

import styles from "./adCardReport.module.css";

export function AdCardReport({ ad }: { readonly ad: Ad }) {
  const { accountId } = useAdAccount();
  const query = useAdsQuery(() => campaignsApi.fetchCardReport(accountId, ad.id), `${accountId}:${ad.id}:cards`, ad.creative.type === "carousel");
  if (ad.creative.type !== "carousel") return null;
  return (
    <Card title="Results by card">
      {query.isLoading ? <LoadingBlock label="Loading card results" /> : null}
      {query.errorMessage ? <ErrorState message={query.errorMessage} onRetry={query.reload} /> : null}
      {query.data ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Card</th>
              <th scope="col">Views</th>
              <th scope="col">Clicks</th>
              <th scope="col">CTR</th>
            </tr>
          </thead>
          <tbody>
            {query.data.items.map((row) => (
              <tr key={row.cardIndex}>
                <th scope="row">
                  {row.cardIndex + 1}. {row.headline}
                </th>
                <td>{formatCompactCount(row.impressions)}</td>
                <td>{formatCompactCount(row.clicks)}</td>
                <td>{(row.ctr * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Card>
  );
}
