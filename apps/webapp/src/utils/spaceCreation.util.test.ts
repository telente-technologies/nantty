import assert from "node:assert/strict";
import {test} from "node:test";
import {completeSpaceCreation,type SpaceCreationCheckpoint} from "./spaceCreation.util";
test("create resumes publication and attachment without duplicate side effects",async()=>{
 const checkpoint:SpaceCreationCheckpoint<{id:string}>={key:"stable-key"};
 let creates=0,publishes=0,attachments=0;
 const create=async()=>{creates++;return {id:"space-1"};};
 const publish=async()=>{publishes++;if(publishes===1)throw new Error("publish failed");return{id:"post-1"};};
 const attach=async()=>{attachments++;if(attachments===1)throw new Error("attach failed");};
 await assert.rejects(()=>completeSpaceCreation(checkpoint,create,publish,attach),/publish failed/);
 await assert.rejects(()=>completeSpaceCreation(checkpoint,create,publish,attach),/attach failed/);
 assert.equal(checkpoint.postId,"post-1");
 assert.deepEqual(await completeSpaceCreation(checkpoint,create,publish,attach),{id:"space-1"});
 assert.equal(creates,1);assert.equal(publishes,2);assert.equal(attachments,2);
});
