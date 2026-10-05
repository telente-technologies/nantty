"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ProductCard } from "@/components/commerce/productCard";
import { IconLabel } from "@/components/ui/appIcon";
import { Avatar } from "@/components/ui/media";
import type { ProductSummary } from "@/types";
import type { SearchItem } from "@/types/search.type";
import { buildPostPath, buildProfilePath, buildStorePath } from "@/utils/seoPaths.util";

import styles from "./page.module.css";

type ItemOf<T extends SearchItem["type"]> = SearchItem & { readonly type: T };

const pick = <T extends SearchItem["type"]>(items: readonly SearchItem[], type: T) => items.filter((item): item is ItemOf<T> => item.type === type);

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function EntityRow({ href, name, meta, avatarUrl, onOpen }: { readonly href: string; readonly name: string; readonly meta: ReactNode; readonly avatarUrl: string | null; readonly onOpen: () => void }) {
  return (
    <li>
      <Link href={href} className={styles.entityRow} onClick={onOpen}>
        <Avatar name={name} src={avatarUrl} size="md" />
        <span className={styles.entityText}>
          <span className={styles.entityName}>{name}</span>
          <span className={styles.entityMeta}>{meta}</span>
        </span>
      </Link>
    </li>
  );
}

export function SearchResultSections({ items, onOpenResult, onSearchHashtag }: { readonly items: readonly SearchItem[]; readonly onOpenResult: () => void; readonly onSearchHashtag: (tag: string) => void }) {
  const products: ProductSummary[] = pick(items, "product").map(({ type: _type, ...product }) => product);
  const posts = [...pick(items, "post"), ...pick(items, "clip")];
  const people = pick(items, "user");
  const stores = pick(items, "store");
  const brands = pick(items, "brand");
  const hashtags = pick(items, "hashtag");
  const categories = pick(items, "category");
  return (
    <>
      {people.length ? (
        <Section title="People">
          <ul className={styles.entityList}>
            {people.map((person) => <EntityRow key={person.id} href={buildProfilePath(person.username)} name={person.name} meta={`@${person.username}`} avatarUrl={person.avatarUrl} onOpen={onOpenResult} />)}
          </ul>
        </Section>
      ) : null}
      {stores.length ? (
        <Section title="Stores">
          <ul className={styles.entityList}>
            {stores.map((store) => (
              <EntityRow key={store.id} href={buildStorePath(store.id)} name={store.name} avatarUrl={store.logoUrl} onOpen={onOpenResult}
                meta={<IconLabel name="star16" size={12}>{store.rating > 0 ? store.rating.toFixed(1) : "New"} · {store.reviewCount} reviews</IconLabel>} />
            ))}
          </ul>
        </Section>
      ) : null}
      {brands.length ? (
        <Section title="Brands">
          <ul className={styles.entityList}>
            {brands.map((brand) => <EntityRow key={brand.id} href={`/store/${brand.id}`} name={brand.name} meta={`@${brand.handle}`} avatarUrl={brand.logoUrl} onOpen={onOpenResult} />)}
          </ul>
        </Section>
      ) : null}
      {categories.length ? (
        <Section title="Categories">
          <ul className={styles.entityList}>
            {categories.map((category) => <EntityRow key={category.id} href={`/category/${category.id}`} name={category.name} meta="Category" avatarUrl={null} onOpen={onOpenResult} />)}
          </ul>
        </Section>
      ) : null}
      {products.length ? (
        <Section title="Products">
          <div className={styles.productGrid}>
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </Section>
      ) : null}
      {posts.length ? (
        <Section title="Posts and clips">
          <ul className={styles.entityList}>
            {posts.map((post) => (
              <EntityRow key={post.id} href={post.type === "clip" ? `/clips?start=${encodeURIComponent(post.id)}` : buildPostPath(post.id)} name={post.caption || (post.type === "clip" ? "Clip" : "Post")}
                meta={`${post.type === "clip" ? "Clip" : "Post"} · ${post.likes} likes`} avatarUrl={post.thumbnailUrl} onOpen={onOpenResult} />
            ))}
          </ul>
        </Section>
      ) : null}
      {hashtags.length ? (
        <Section title="Hashtags">
          <ul className={styles.entityList}>
            {hashtags.map((hashtag) => (
              <li key={hashtag.id}>
                <button type="button" className={styles.entityRow} onClick={() => onSearchHashtag(hashtag.tag)}>
                  <span className={styles.entityText}>
                    <span className={styles.entityName}>#{hashtag.tag}</span>
                    <span className={styles.entityMeta}>{hashtag.postCount} posts</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
