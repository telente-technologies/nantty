import { buildSuggestedVideoSequence, collectSuggestedRailClips } from "../suggestedVideoSequence.util";

const clip = (id: string, sponsored: unknown = null) => ({ id, sponsored });

describe("suggested videos sequence", () => {
  it("starts with the tapped clip and never repeats it or any other clip across pages", () => {
    const sequence = buildSuggestedVideoSequence(clip("tapped"), [[clip("a"), clip("tapped"), clip("b")], [clip("b"), clip("c")]]);
    expect(sequence.map((item) => item.id)).toEqual(["tapped", "a", "b", "c"]);
  });

  it("still plays the stream when the tapped clip could not be loaded, and copes with no suggestions", () => {
    expect(buildSuggestedVideoSequence(null, [[clip("a")]]).map((item) => item.id)).toEqual(["a"]);
    expect(buildSuggestedVideoSequence(clip("tapped"), [])).toEqual([clip("tapped")]);
  });

  it("keeps ads out of the rail", () => {
    expect(collectSuggestedRailClips([[clip("a"), clip("ad", { campaignId: "x" }), clip("b")], [clip("a")]]).map((item) => item.id)).toEqual(["a", "b"]);
  });
});
