import { conversationBubbleDraftKey } from "./chatBubblePreferences.util";

interface RecordStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export function createBubbleDraftStore(records: RecordStore) {
  const writes = new Map<string, Promise<void>>();

  return {
    async get(accountId: string, conversationId: string): Promise<string> {
      const key = conversationBubbleDraftKey(accountId, conversationId);
      await writes.get(key)?.catch(() => undefined);
      return (await records.get(key)) ?? "";
    },
    save(accountId: string, conversationId: string, draft: string): Promise<void> {
      const key = conversationBubbleDraftKey(accountId, conversationId);
      const operation = async () => draft.length === 0 ? records.delete(key) : records.set(key, draft);
      const result = (writes.get(key) ?? Promise.resolve()).catch(() => undefined).then(operation);
      writes.set(key, result);
      void result.finally(() => { if (writes.get(key) === result) writes.delete(key); }).catch(() => undefined);
      return result;
    },
    async flush(): Promise<void> {
      await Promise.all([...writes.values()].map((write) => write.catch(() => undefined)));
    },
  };
}
