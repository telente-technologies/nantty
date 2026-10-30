export interface SpaceCreationCheckpoint<T> {
 key: string;
 space?: T;
 postId?: string;
}
/** Keep each successful side effect before continuing, so retries resume instead of duplicating. */
export async function completeSpaceCreation<T>(
 checkpoint: SpaceCreationCheckpoint<T>,
 create: () => Promise<T>,
 publish: (space:T) => Promise<{id:string}>,
 attach: (space:T,postId:string) => Promise<unknown>,
):Promise<T> {
 if (!checkpoint.space) checkpoint.space = await create();
 if (!checkpoint.postId) checkpoint.postId = (await publish(checkpoint.space)).id;
 await attach(checkpoint.space,checkpoint.postId);
 return checkpoint.space;
}

