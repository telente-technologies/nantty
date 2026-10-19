interface Identified {
  readonly id: string;
}

export function buildSuggestedVideoSequence<Clip extends Identified>(startClip: Clip | null, pages: readonly (readonly Clip[])[]): Clip[] {
  const seenClipIds = new Set<string>();
  const sequence: Clip[] = [];
  const append = (clip: Clip) => {
    if (seenClipIds.has(clip.id)) return;
    seenClipIds.add(clip.id);
    sequence.push(clip);
  };
  if (startClip) append(startClip);
  for (const page of pages) for (const clip of page) append(clip);
  return sequence;
}

export function collectSuggestedRailClips<Clip extends Identified & { readonly sponsored?: unknown }>(pages: readonly (readonly Clip[])[]): Clip[] {
  return buildSuggestedVideoSequence<Clip>(null, pages.map((page) => page.filter((clip) => clip.sponsored === null || clip.sponsored === undefined)));
}
