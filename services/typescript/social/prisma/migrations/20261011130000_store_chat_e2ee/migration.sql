-- Customer <-> store chats are end-to-end encrypted like every other chat (store team = sender-key group).
DELETE FROM "messages" WHERE "protocol" <> 'signal-v1';
ALTER TABLE "messages" ADD CONSTRAINT "messages_end_to_end_encrypted" CHECK ("protocol" = 'signal-v1' AND ("kind" = 'system' OR "ciphertext" IS NOT NULL));
