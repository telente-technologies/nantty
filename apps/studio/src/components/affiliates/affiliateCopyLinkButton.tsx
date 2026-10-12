"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon } from "@/components/ui/icons";
import { webappLinks } from "@/config/webappLinks.config";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { affiliatesService } from "@/services/affiliates.service";
import type { AffiliateLink } from "@/types/affiliate.type";

import styles from "./affiliates.module.css";

export function AffiliateCopyLinkButton({ productId, productName, existingLink }: { readonly productId: string; readonly productName: string; readonly existingLink: AffiliateLink | null }) {
  const queryClient = useQueryClient();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const copy = useMutation({
    mutationFn: async () => existingLink ?? (await affiliatesService.createLink(productId)),
    onSuccess: async (link) => {
      const url = webappLinks.affiliateProductLink(link.path);
      try {
        await navigator.clipboard.writeText(url);
        setCopiedUrl(url);
        setManualUrl(null);
      } catch {
        setManualUrl(url);
      }
      if (!existingLink) void queryClient.invalidateQueries({ queryKey: ["affiliates"] });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: ["affiliates", "catalog"] }),
  });
  return (
    <span className={styles.body}>
      <Button size="sm" variant={copiedUrl ? "secondary" : "primary"} busy={copy.isPending} aria-label={`Copy your link for ${productName}`}
        leadingIcon={copiedUrl ? <CheckIcon size={16} /> : <CopyIcon size={16} />} onClick={() => copy.mutate()}>
        {copiedUrl ? "Link copied" : "Copy link"}
      </Button>
      {manualUrl ? <input className={styles.note} readOnly value={manualUrl} aria-label="Your link" onFocus={(event) => event.currentTarget.select()} /> : null}
      {copy.isError ? <span className={styles.error} role="alert">{readErrorMessageForDisplay(copy.error)}</span> : null}
    </span>
  );
}
