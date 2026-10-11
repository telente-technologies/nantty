"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modalDialog";
import { buildEncryptedThumbnail, readImageSize, uploadEncryptedAttachment } from "@/services/chatCrypto/encryptedAttachments.service";
import { buildPollDefinition, messagesService, type OutgoingAttachmentKind } from "@/services/messages.service";
import type { OptimisticPerform } from "./optimisticSends.hook";
import type { Conversation, Message } from "@/types";
import { liveUntilFromMinutes, validatePollDraft } from "@/utils/chatThread.util";

import styles from "./richMessage.module.css";

interface ChatComposerToolsProps {
  readonly conversation: Conversation;
  readonly viewerId: string;
  readonly sendOptimistically: (draft: Partial<Message>, perform: OptimisticPerform) => void;
}


function attachmentKindOf(file: File): OutgoingAttachmentKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "voice";
  return "document";
}

export function ChatComposerTools({ conversation, viewerId, sendOptimistically }: ChatComposerToolsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"poll" | "location" | null>(null);
  const mediaInput = useRef<HTMLInputElement | null>(null);
  const documentInput = useRef<HTMLInputElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);

  function sendFile(file: File, forcedKind?: OutgoingAttachmentKind, durationSeconds?: number) {
    const kind = forcedKind ?? attachmentKindOf(file);
    setError(null);
    sendOptimistically({ kind, pendingLabel: "Encrypting…" }, async (key, report) => {
      const isImage = kind === "image";
      const size = isImage ? await readImageSize(file) : { width: null, height: null };
      const thumbnail = isImage ? await buildEncryptedThumbnail(file) : null;
      const uploaded = await uploadEncryptedAttachment(
        file,
        { contentType: file.type || "application/octet-stream", fileName: kind === "document" ? file.name : null, ...size, thumbnail, durationSeconds: durationSeconds ?? null },
        kind === "voice" ? "voice" : "chat",
        (fraction) => report(`Uploading ${Math.round(fraction * 100)}%…`),
      );
      return messagesService.sendAttachment(conversation, viewerId, { kind, mediaId: uploaded.mediaId, pointer: uploaded.pointer }, key);
    });
  }

  async function toggleRecording() {
    if (recorder.current) {
      recorder.current.stop();
      return;
    }
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice notes aren't supported in this browser. Attach an audio file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const started = Date.now();
      const media = new MediaRecorder(stream);
      media.ondataavailable = (event) => chunks.push(event.data);
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recorder.current = null;
        setRecordingStartedAt(null);
        const type = media.mimeType || "audio/webm";
        const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));
        sendFile(new File([new Blob(chunks, { type })], "voice-note", { type }), "voice", seconds);
      };
      recorder.current = media;
      media.start();
      setRecordingStartedAt(started);
    } catch {
      setError("Allow microphone access to record a voice note.");
    }
  }

  const menuItems = ["Photo or video", "Document", "Voice note", "Location", "Poll"] as const;

  function selectMenuItem(item: (typeof menuItems)[number]) {
    setIsMenuOpen(false);
    if (item === "Photo or video") mediaInput.current?.click();
    else if (item === "Document") documentInput.current?.click();
    else if (item === "Voice note") void toggleRecording();
    else setDialog(item === "Location" ? "location" : "poll");
  }

  return (
    <div className={styles.attachMenu}>
      <button type="button" className={styles.attachTrigger} aria-label="Attach" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((open) => !open)}>
        +
      </button>
      {isMenuOpen ? (
        <div className={styles.attachList} role="menu" aria-label="Attach">
          {menuItems.map((item) => (
            <button key={item} type="button" role="menuitem" className={styles.attachItem} onClick={() => selectMenuItem(item)}>
              {item}
            </button>
          ))}
        </div>
      ) : null}
      <input ref={mediaInput} type="file" accept="image/*,video/*" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) sendFile(file); }} />
      <input ref={documentInput} type="file" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) sendFile(file, "document"); }} />
      {recordingStartedAt !== null ? (
        <span className={styles.recording} role="status">
          Recording… <Button size="sm" variant="secondary" onClick={() => recorder.current?.stop()}>Stop and send</Button>
        </span>
      ) : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <PollDialog isOpen={dialog === "poll"} onClose={() => setDialog(null)} onSubmit={async (draft) => {
        const poll = buildPollDefinition(draft);
        sendOptimistically({ kind: "poll", poll }, (key) => messagesService.sendPoll(conversation, viewerId, poll, key));
        setDialog(null);
      }} />
      <LocationDialog isOpen={dialog === "location"} onClose={() => setDialog(null)} onSubmit={async (location) => {
        sendOptimistically({ kind: location.liveUntil ? "liveLocation" : "location", location }, (key) => messagesService.sendLocation(conversation, viewerId, location, key));
        setDialog(null);
      }} />
    </div>
  );
}

function PollDialog({ isOpen, onClose, onSubmit }: { readonly isOpen: boolean; readonly onClose: () => void; readonly onSubmit: (poll: { question: string; allowMultipleAnswers: boolean; options: string[] }) => Promise<void> }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [allowMultipleAnswers, setAllowMultipleAnswers] = useState(false);
  const [busy, setBusy] = useState(false);
  const problem = validatePollDraft(question, options);
  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create poll"
      description="The question, options and votes are end-to-end encrypted."
      intent="poll"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={problem !== null} busy={busy} onClick={async () => { setBusy(true); await onSubmit({ question, allowMultipleAnswers, options }); setBusy(false); setQuestion(""); setOptions(["", ""]); }}>Send poll</Button>
        </>
      }
    >
      <div className={styles.form}>
        <input className={styles.input} aria-label="Question" placeholder="Ask a question" maxLength={300} value={question} onChange={(event) => setQuestion(event.target.value)} />
        {options.map((option, index) => (
          <input key={index} className={styles.input} aria-label={`Option ${index + 1}`} placeholder={`Option ${index + 1}`} maxLength={100} value={option} onChange={(event) => setOptions((current) => current.map((value, position) => (position === index ? event.target.value : value)))} />
        ))}
        {options.length < 6 ? <Button variant="ghost" size="sm" onClick={() => setOptions((current) => [...current, ""])}>Add option</Button> : null}
        <label className={styles.row}>
          <input type="checkbox" checked={allowMultipleAnswers} onChange={(event) => setAllowMultipleAnswers(event.target.checked)} /> Allow multiple answers
        </label>
        {problem && question ? <p className={styles.status}>{problem}</p> : null}
      </div>
    </ModalDialog>
  );
}

function LocationDialog({ isOpen, onClose, onSubmit }: { readonly isOpen: boolean; readonly onClose: () => void; readonly onSubmit: (location: { latitude: number; longitude: number; label: string | null; liveUntil: string | null }) => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [liveMinutes, setLiveMinutes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  function share() {
    if (!navigator.geolocation) {
      setProblem("Your browser can't share a location.");
      return;
    }
    setBusy(true);
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await onSubmit({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: label.trim() || null, liveUntil: liveMinutes > 0 ? liveUntilFromMinutes(liveMinutes, new Date()) : null });
        setBusy(false);
        setLabel("");
      },
      () => {
        setBusy(false);
        setProblem("Allow location access to share where you are.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }
  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Share location"
      description="Your location is end-to-end encrypted. Only people in this chat can see it."
      intent="location"
      busy={busy}
      errorMessage={problem}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button busy={busy} onClick={share}>{liveMinutes > 0 ? "Share live location" : "Send current location"}</Button>
        </>
      }
    >
      <div className={styles.form}>
        <input className={styles.input} aria-label="Place name (optional)" placeholder="Place name (optional)" maxLength={200} value={label} onChange={(event) => setLabel(event.target.value)} />
        <label className={styles.row}>
          Share live for
          <select className={styles.input} value={liveMinutes} onChange={(event) => setLiveMinutes(Number(event.target.value))}>
            <option value={0}>Don&apos;t share live</option>
            <option value={15}>15 minutes</option>
            <option value={60}>1 hour</option>
            <option value={480}>8 hours</option>
          </select>
        </label>
        {liveMinutes > 0 ? <p className={styles.status}>Keep this tab open to keep updating your live location.</p> : null}
      </div>
    </ModalDialog>
  );
}
