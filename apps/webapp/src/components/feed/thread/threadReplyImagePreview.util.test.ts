import assert from "node:assert/strict";
import { test } from "node:test";

import { describeThreadReplyImagePreview } from "./threadReplyImagePreview.util";

test("reply image preview has an accessible trigger, title, and image description", () => {
  assert.deepEqual(describeThreadReplyImagePreview("Amina Bello"), {
    buttonLabel: "View image in Amina Bello's reply",
    dialogTitle: "Image in Amina Bello's reply",
    imageAlt: "Image in reply by Amina Bello",
  });
});
