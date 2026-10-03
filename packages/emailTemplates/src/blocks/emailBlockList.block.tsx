import { Fragment } from "react";

import type { EmailBlock } from "../emailTypes";
import { ButtonBlock, CalloutBlock, CodeBlock, DividerBlock, HeroBlock, LinksBlock, ListBlock, ParagraphBlock, QuoteBlock } from "./emailBasics.block";
import { DetailsBlock, OrderGroupsBlock, ProductsBlock, TotalsBlock } from "./emailCommerce.block";
import { PeopleBlock, ProgressBlock, RatingBlock, StepsBlock, TrackBlock } from "./emailProgress.block";

function renderBlock(block: EmailBlock) {
  switch (block.type) {
    case "hero":
      return <HeroBlock eyebrow={block.eyebrow} title={block.title} tone={block.tone} />;
    case "paragraph":
      return <ParagraphBlock text={block.text} muted={block.muted} />;
    case "button":
      return <ButtonBlock label={block.label} href={block.href} tone={block.tone} />;
    case "links":
      return <LinksBlock items={block.items} />;
    case "callout":
      return <CalloutBlock tone={block.tone} title={block.title} text={block.text} />;
    case "details":
      return <DetailsBlock title={block.title} rows={block.rows} />;
    case "code":
      return <CodeBlock code={block.code} caption={block.caption} />;
    case "orderGroups":
      return <OrderGroupsBlock groups={block.groups} />;
    case "totals":
      return <TotalsBlock rows={block.rows} total={block.total} />;
    case "track":
      return <TrackBlock steps={block.steps} current={block.current} tone={block.tone} caption={block.caption} />;
    case "steps":
      return <StepsBlock items={block.items} />;
    case "progress":
      return <ProgressBlock items={block.items} />;
    case "products":
      return <ProductsBlock title={block.title} items={block.items} />;
    case "list":
      return <ListBlock title={block.title} items={block.items} />;
    case "quote":
      return <QuoteBlock author={block.author} text={block.text} meta={block.meta} />;
    case "people":
      return <PeopleBlock items={block.items} more={block.more} />;
    case "rating":
      return <RatingBlock question={block.question} options={block.options} />;
    case "divider":
      return <DividerBlock />;
  }
}

export function EmailBlockList({ blocks }: { readonly blocks: readonly EmailBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => (
        <Fragment key={`${block.type}-${index}`}>{renderBlock(block)}</Fragment>
      ))}
    </>
  );
}
