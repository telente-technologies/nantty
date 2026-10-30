import {completeSpaceCreation, type SpaceCreationCheckpoint} from "@/utils/spaceCreation.util";
describe("creation publishes an announcement before reporting success",()=>{
 it("resumes after publish failure without creating another Space",async()=>{
  const checkpoint:SpaceCreationCheckpoint<{id:string}>={key:"stable-create-key"};
  const create=jest.fn(async()=>({id:"space-1"}));
  const publish=jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({id:"post-1"});
  const attach=jest.fn(async()=>undefined);
  await expect(completeSpaceCreation(checkpoint,create,publish,attach)).rejects.toThrow("offline");
  expect(checkpoint.space?.id).toBe("space-1");expect(attach).not.toHaveBeenCalled();
  await expect(completeSpaceCreation(checkpoint,create,publish,attach)).resolves.toEqual({id:"space-1"});
  expect(create).toHaveBeenCalledTimes(1);expect(attach).toHaveBeenCalledWith({id:"space-1"},"post-1");
 });
 it("retries attachment using the existing post and reports no success on failed attach",async()=>{
  const checkpoint:SpaceCreationCheckpoint<{id:string}>={key:"stable-create-key"};
  const create=jest.fn(async()=>({id:"space-2"}));const publish=jest.fn(async()=>({id:"post-2"}));
  const attach=jest.fn().mockRejectedValueOnce(new Error("verification unavailable")).mockResolvedValue(undefined);
  await expect(completeSpaceCreation(checkpoint,create,publish,attach)).rejects.toThrow("verification unavailable");
  expect(checkpoint.postId).toBe("post-2");
  await completeSpaceCreation(checkpoint,create,publish,attach);
  expect(create).toHaveBeenCalledTimes(1);expect(publish).toHaveBeenCalledTimes(1);expect(attach).toHaveBeenCalledTimes(2);
 });
});

