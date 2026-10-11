"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { readChatCryptoErrorMessage } from "@/services/chatCrypto/chatCrypto.service";
import { chatGroupsService } from "@/services/chatGroups.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import type { UserSummary } from "@/types";
import { validateGroupPhotoFile } from "@/utils/groupPhoto.util";

import { PeoplePicker, togglePerson } from "./peoplePicker";
import styles from "./richMessage.module.css";

export function NewGroupDialog({ isOpen, onClose }: { readonly isOpen: boolean; readonly onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { viewer } = useSession();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<readonly UserSummary[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => {
      if (!viewer?.id) throw new Error("Sign in to create a group.");
      const avatar = photo ? await chatGroupsService.uploadGroupPhoto(photo) : null;
      return chatGroupsService.createGroup(viewer.id, { title: name.trim(), description: description.trim() || null, avatar }, members.map((member) => member.id));
    },
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setName("");
      setDescription("");
      setMembers([]);
      setPhoto(null);
      onClose();
      router.push(`/chats/${encodeURIComponent(conversation.id)}`);
    },
  });
  const canCreate = name.trim().length > 0 && members.length > 0;
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="New group"
      description="The group name, description and messages are end-to-end encrypted."
      layout="sheet"
      size="medium"
      intent="team"
      busy={create.isPending}
      errorMessage={create.isError ? (readChatCryptoErrorMessage(create.error) ?? readErrorMessageForDisplay(create.error)) : null}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!canCreate} busy={create.isPending} onClick={() => create.mutate()}>
            Create group
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <input className={styles.input} aria-label="Group name" placeholder="Group name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
        <input className={styles.input} aria-label="Description (optional)" placeholder="Description (optional)" maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} />
        <label className={styles.row}>
          Group photo (optional, encrypted)
          <input
            type="file"
            accept="image/*"
            aria-label="Group photo"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              const problem = file ? validateGroupPhotoFile(file) : null;
              setPhotoProblem(problem);
              setPhoto(problem ? null : file);
            }}
          />
        </label>
        {photoProblem ? <p className={styles.error} role="alert">{photoProblem}</p> : null}
        <PeoplePicker selected={members} onToggle={(person) => setMembers((current) => togglePerson(current, person))} maximum={255} />
      </div>
    </Dialog>
  );
}
