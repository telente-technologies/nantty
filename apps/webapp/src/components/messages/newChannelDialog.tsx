"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { channelsService } from "@/services/channels.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";

import styles from "./richMessage.module.css";

export function NewChannelDialog({ isOpen, onClose }: { readonly isOpen: boolean; readonly onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useMutation({
    mutationFn: () => channelsService.createBroadcastChannel({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: (channel) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setName("");
      setDescription("");
      onClose();
      router.push(`/chats/${encodeURIComponent(channel.id)}`);
    },
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="New channel"
      description="Create a broadcast channel for your followers."
      layout="sheet"
      size="medium"
      intent="team"
      busy={create.isPending}
      errorMessage={create.isError ? readErrorMessageForDisplay(create.error) : null}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim()} busy={create.isPending} onClick={() => create.mutate()}>Create channel</Button>
        </>
      }
    >
      <div className={styles.form}>
        <input className={styles.input} aria-label="Channel name" placeholder="Channel name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
        <textarea className={styles.input} aria-label="Channel description" placeholder="What will you post? (optional)" maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
    </Dialog>
  );
}
