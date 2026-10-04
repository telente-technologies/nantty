import { describe, expect, it } from "vitest";

import { SocialError } from "../../src/errors/social.error.js";
import { loadPostVisibleToViewer } from "../../src/modules/posts/services/postAccess.service.js";
import { buildPostViews } from "../../src/modules/posts/services/postView.service.js";
import {
  advisoryLabelsAboveThreshold, buildSensitiveContentView, buildViewerContentPolicy, computeEffectiveSensitiveLabels, isPostWithheldFromViewer, labelsWithheldFromAgeBracket, sensitiveLabelFilterForViewer,
} from "../../src/modules/posts/services/sensitiveContent.service.js";
import { assertAuthorAgeAllowsSensitiveLabels } from "../../src/modules/posts/services/postAudienceRules.service.js";
import { readViewerAgeBracketFromGatewayHeader } from "../../src/middlewares/principal.middleware.js";
import { runWithViewerAgeBracket } from "../../src/utils/viewerAgeContext.util.js";
import { authorId, buildFakeContext, buildPostRow, viewerId } from "./socialPostFakes.fake.js";

const nudityPost = buildPostRow({ id: "0192f0a0-0000-7000-8000-000000000010", sensitiveLabels: ["nudity"] });
const dangerousPost = buildPostRow({ id: "0192f0a0-0000-7000-8000-000000000011", sensitiveLabels: ["dangerous_acts"] });
const violencePost = buildPostRow({ id: "0192f0a0-0000-7000-8000-000000000012", sensitiveLabels: ["graphic_violence"] });
const plainPost = buildPostRow({ id: "0192f0a0-0000-7000-8000-000000000013" });

describe("age gate", () => {
  it("withholds nudity and dangerous acts from minors, unknown ages and guests but never from adults", () => {
    expect(labelsWithheldFromAgeBracket("minor")).toEqual(["nudity", "dangerous_acts"]);
    expect(labelsWithheldFromAgeBracket("unknown")).toEqual(["nudity", "dangerous_acts"]);
    expect(labelsWithheldFromAgeBracket("adult")).toEqual([]);
    expect(readViewerAgeBracketFromGatewayHeader(undefined)).toBe("unknown");
    expect(readViewerAgeBracketFromGatewayHeader("ADULT")).toBe("adult");
    expect(readViewerAgeBracketFromGatewayHeader("over-18")).toBe("unknown");
  });

  it("filters withheld labels in the database query and in memory", () => {
    const minor = buildViewerContentPolicy({ viewerId, ageBracket: "minor" }, true);
    expect(sensitiveLabelFilterForViewer(minor)).toEqual({ NOT: { sensitiveLabels: { hasSome: ["nudity", "dangerous_acts"] } } });
    expect(sensitiveLabelFilterForViewer(buildViewerContentPolicy({ viewerId, ageBracket: "adult" }, false))).toEqual({});
    expect(isPostWithheldFromViewer(nudityPost, minor)).toBe(true);
    expect(isPostWithheldFromViewer(violencePost, minor)).toBe(false);
    expect(isPostWithheldFromViewer(nudityPost, { viewerId: authorId, withheldLabels: minor.withheldLabels })).toBe(false);
    expect(minor.showSensitiveWithoutWarning).toBe(false);
  });

  it("never sends a labelled nudity post to an under-18 viewer in a feed page", async () => {
    const context = buildFakeContext([nudityPost, dangerousPost, violencePost, plainPost]);
    const views = await runWithViewerAgeBracket("minor", () => buildPostViews(context, viewerId, [nudityPost, dangerousPost, violencePost, plainPost]));
    expect(views.map((view) => view.id)).toEqual([violencePost.id, plainPost.id]);
    expect(views[0]?.sensitive).toEqual({ labels: ["graphic_violence"], requiresInterstitial: true });
    const guestViews = await buildPostViews(context, undefined, [nudityPost, plainPost]);
    expect(guestViews.map((view) => view.id)).toEqual([plainPost.id]);
  });

  it("drops a withheld original from a quote instead of leaking it", async () => {
    const quote = buildPostRow({ id: "0192f0a0-0000-7000-8000-000000000020", authorId: viewerId, resharedFromId: nudityPost.id, isQuote: true, text: "look" });
    const views = await runWithViewerAgeBracket("minor", () => buildPostViews(buildFakeContext([nudityPost, quote]), viewerId, [quote]));
    expect(views[0]?.resharedFrom).toBeNull();
    expect(views[0]?.resharedFromUnavailable).toBe(true);
  });

  it("answers a direct link with not available for minors and shows adults the interstitial", async () => {
    const context = buildFakeContext([nudityPost]);
    await expect(runWithViewerAgeBracket("minor", () => loadPostVisibleToViewer(context, viewerId, nudityPost.id))).rejects.toMatchObject({ status: 404, code: "POST_NOT_AVAILABLE" });
    await expect(loadPostVisibleToViewer(context, undefined, nudityPost.id)).rejects.toBeInstanceOf(SocialError);
    const adultViews = await runWithViewerAgeBracket("adult", () => buildPostViews(context, viewerId, [nudityPost]));
    expect(adultViews[0]?.sensitive?.requiresInterstitial).toBe(true);
    const optedOut = await runWithViewerAgeBracket("adult", () => buildPostViews(buildFakeContext([nudityPost], { showSensitiveWithoutWarning: true }), viewerId, [nudityPost]));
    expect(optedOut[0]?.sensitive?.requiresInterstitial).toBe(false);
  });

  it("builds the interstitial state for authors, opted-out adults and unlabeled posts", () => {
    expect(buildSensitiveContentView(plainPost, { viewerId, showSensitiveWithoutWarning: false })).toBeNull();
    expect(buildSensitiveContentView(violencePost, { viewerId: authorId, showSensitiveWithoutWarning: false })?.requiresInterstitial).toBe(false);
    expect(buildSensitiveContentView(violencePost, { viewerId, showSensitiveWithoutWarning: false })?.requiresInterstitial).toBe(true);
  });

  it("merges labels from the poster, moderation and advisory scores without letting advisory override a review", () => {
    expect(advisoryLabelsAboveThreshold([{ label: "nudity", score: 0.93 }, { label: "self_harm", score: 0.4 }])).toEqual(["nudity"]);
    expect(computeEffectiveSensitiveLabels({ author: ["graphic_violence"], moderation: [], advisory: ["nudity"], reviewedByModeration: false })).toEqual(["nudity", "graphic_violence"]);
    expect(computeEffectiveSensitiveLabels({ author: [], moderation: [], advisory: ["nudity"], reviewedByModeration: true })).toEqual([]);
  });

  it("stops under-18 and unknown-age authors from posting adult categories", () => {
    expect(() => assertAuthorAgeAllowsSensitiveLabels("minor", ["nudity"])).toThrow(/18 or older/);
    expect(() => assertAuthorAgeAllowsSensitiveLabels("unknown", ["dangerous_acts"])).toThrow(/18 or older/);
    expect(() => assertAuthorAgeAllowsSensitiveLabels("minor", ["graphic_violence"])).not.toThrow();
    expect(() => assertAuthorAgeAllowsSensitiveLabels("adult", ["nudity"])).not.toThrow();
  });
});
