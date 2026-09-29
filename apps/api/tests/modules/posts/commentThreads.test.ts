import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication, type SignedInUser } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

interface CommentBody {
  readonly id: string;
  readonly parentCommentId: string | null;
  readonly rootCommentId: string | null;
  readonly replyToCommentId: string | null;
  readonly text: string;
  readonly author: { readonly id: string } | null;
  readonly replyCount: number;
  readonly replyingTo?: { readonly userId: string; readonly username: string };
  readonly deleted?: boolean;
  readonly previewReplies?: readonly CommentBody[];
}

interface CommentPage {
  readonly data: readonly CommentBody[];
  readonly nextCursor: string | null;
}

async function createPost(author: SignedInUser): Promise<string> {
  return (await app.client.post("/api/v1/posts").auth(author.accessToken).send({ text: "Thread me" }).expect(201)).json<{ id: string }>().id;
}

async function comment(user: SignedInUser, postId: string, text: string, parentCommentId?: string): Promise<CommentBody> {
  app.clock.advanceBySeconds(1);
  const body = parentCommentId === undefined ? { text } : { text, parentCommentId };
  return (await app.client.post(`/api/v1/posts/${postId}/comments`).auth(user.accessToken).send(body).expect(201)).json<CommentBody>();
}

async function listTopLevel(postId: string, query = ""): Promise<CommentPage> {
  return (await app.client.get(`/api/v1/posts/${postId}/comments${query}`).expect(200)).json<CommentPage>();
}

async function listReplies(commentId: string, query = ""): Promise<CommentPage> {
  return (await app.client.get(`/api/v1/comments/${commentId}/replies${query}`).expect(200)).json<CommentPage>();
}

describe("threaded comments", () => {
  it("stores parent and root at any depth and counts replies on parent and root", async () => {
    const [author, ada, bola, chi] = [await app.registerUser(), await app.registerUser(), await app.registerUser(), await app.registerUser()];
    const postId = await createPost(author);
    const root = await comment(ada, postId, "Where can I buy this?");
    const reply = await comment(bola, postId, "Same question", root.id);
    const nested = await comment(chi, postId, "Check the store link", reply.id);
    app.clock.advanceBySeconds(1);
    const legacy = (await app.client.post(`/api/v1/posts/${postId}/comments`).auth(author.accessToken).send({ text: "In bio", replyToCommentId: nested.id }).expect(201)).json<CommentBody>();

    expect(reply).toMatchObject({ parentCommentId: root.id, rootCommentId: root.id, replyingTo: { userId: ada.userId, username: ada.username } });
    expect(nested).toMatchObject({ parentCommentId: reply.id, rootCommentId: root.id, replyToCommentId: reply.id, replyingTo: { userId: bola.userId } });
    expect(legacy).toMatchObject({ parentCommentId: nested.id, rootCommentId: root.id });

    const [listedRoot] = (await listTopLevel(postId)).data;
    expect(listedRoot).toMatchObject({ id: root.id, replyCount: 3 });
    expect(listedRoot?.previewReplies?.map((item) => item.id)).toEqual([reply.id, nested.id]);

    const thread = await listReplies(root.id);
    expect(thread.data.map((item) => item.id)).toEqual([reply.id, nested.id, legacy.id]);
    const direct = await listReplies(reply.id);
    expect(direct.data.map((item) => item.id)).toEqual([nested.id]);
    expect(direct.data[0]?.replyCount).toBe(1);
    await app.client.get(`/api/v1/posts/${postId}`).expect(200).expectJson({ comments: 4 });

    const other = await createPost(author);
    await app.client.post(`/api/v1/posts/${other}/comments`).auth(ada.accessToken).send({ text: "wrong post", parentCommentId: root.id }).expect(422);
  });

  it("paginates top-level comments and replies oldest first", async () => {
    const [author, fan] = [await app.registerUser(), await app.registerUser()];
    const postId = await createPost(author);
    const roots: CommentBody[] = [];
    for (let index = 0; index < 3; index += 1) roots.push(await comment(fan, postId, `root ${index}`));
    for (let index = 0; index < 3; index += 1) await comment(author, postId, `reply ${index}`, roots[0]?.id);

    const first = await listTopLevel(postId, "?limit=2");
    expect(first.data.map((item) => item.text)).toEqual(["root 0", "root 1"]);
    const second = await listTopLevel(postId, `?limit=2&cursor=${first.nextCursor}`);
    expect(second.data.map((item) => item.text)).toEqual(["root 2"]);
    expect(second.nextCursor).toBeNull();
    expect(first.data[0]?.previewReplies?.map((item) => item.text)).toEqual(["reply 0", "reply 1"]);

    const firstReplies = await listReplies(roots[0]?.id ?? "", "?limit=2");
    const moreReplies = await listReplies(roots[0]?.id ?? "", `?limit=2&cursor=${firstReplies.nextCursor}`);
    expect([...firstReplies.data, ...moreReplies.data].map((item) => item.text)).toEqual(["reply 0", "reply 1", "reply 2"]);
  });

  it("soft-deletes while keeping the thread shape and enforces who may delete", async () => {
    const [author, ada, bola, stranger] = [await app.registerUser(), await app.registerUser(), await app.registerUser(), await app.registerUser()];
    const postId = await createPost(author);
    const root = await comment(ada, postId, "Original");
    const reply = await comment(bola, postId, "Answer", root.id);

    await app.client.delete(`/api/v1/comments/${root.id}`).auth(stranger.accessToken).expect(403);
    await app.client.delete(`/api/v1/comments/${root.id}`).auth(ada.accessToken).expect(204);
    await app.client.delete(`/api/v1/comments/${root.id}`).auth(ada.accessToken).expect(404);
    const [deletedRoot] = (await listTopLevel(postId)).data;
    expect(deletedRoot).toMatchObject({ id: root.id, deleted: true, author: null, replyCount: 1 });
    expect(deletedRoot?.text).not.toBe("Original");
    expect(deletedRoot?.previewReplies?.[0]).toMatchObject({ id: reply.id, text: "Answer" });
    expect(deletedRoot?.previewReplies?.[0]?.replyingTo).toBeUndefined();

    await app.client.delete(`/api/v1/comments/${reply.id}`).auth(author.accessToken).expect(204);
    expect((await listTopLevel(postId)).data).toEqual([]);
    await app.client.get(`/api/v1/posts/${postId}`).expect(200).expectJson({ comments: 0 });

    const kept = await comment(ada, postId, "Keep me");
    const removedLeaf = await comment(bola, postId, "Remove me", kept.id);
    await app.client.delete(`/api/v1/posts/${postId}/comments/${removedLeaf.id}`).auth(bola.accessToken).expect(204);
    const [keptRoot] = (await listTopLevel(postId)).data;
    expect(keptRoot).toMatchObject({ id: kept.id, replyCount: 0, previewReplies: [] });
    expect((await listReplies(kept.id)).data).toEqual([]);
  });

  it("notifies the author of the comment being replied to", async () => {
    const [author, ada, bola] = [await app.registerUser(), await app.registerUser(), await app.registerUser()];
    const postId = await createPost(author);
    const root = await comment(ada, postId, "First");
    await comment(bola, postId, "Reply to Ada", root.id);
    const notifications = (await app.client.get("/api/v1/notifications").auth(ada.accessToken).expect(200)).json<{ data: { title: string }[] }>();
    expect(notifications.data.map((item) => item.title)).toContain("New reply");
  });
});
