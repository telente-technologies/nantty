"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSession } from "@/components/providers/sessionProvider";
import { composerService } from "@/services/composer.service";
import { createIdempotencyKey } from "@/services/clientApi.service";
import { spacesService, type Space, type SpaceGrant } from "@/services/spaces.service";
import { completeSpaceCreation, type SpaceCreationCheckpoint } from "@/utils/spaceCreation.util";

import { useSpaceAudio } from "./spaceAudio.hook";
import { SpaceCreationPanel } from "./spaceCreationPanel";
import { SpaceRoomPanel } from "./spaceRoomPanel";
import { SpacesDirectoryPanel } from "./spacesDirectoryPanel";
import styles from "./spaces.module.css";

interface SpacesProps {
  readonly spaceId?: string;
  readonly creating?: boolean;
}

export function Spaces(props: SpacesProps) {
  const routeKey = props.creating ? "create" : props.spaceId ? `space:${props.spaceId}` : "directory";
  return <SpacesContent key={routeKey} {...props} />;
}

function SpacesContent({
  spaceId,
  creating = false,
}: SpacesProps) {
  const { viewer } = useSession();
  const router = useRouter();
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState("");
  const [coinDonationsEnabled, setCoinDonationsEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [canRetryAnnouncement, setCanRetryAnnouncement] = useState(false);
  const [grant, setGrant] = useState<SpaceGrant | null>(null);
  const creation = useRef<SpaceCreationCheckpoint<Space>>({
    key: createIdempotencyKey("space"),
  });

  const list = useQuery({
    queryKey: ["spaces"],
    queryFn: spacesService.list,
    enabled: !spaceId && !creating,
    refetchInterval: 30000,
  });
  const detail = useQuery({
    queryKey: ["spaces", spaceId],
    queryFn: () => spacesService.detail(spaceId!),
    enabled: !!spaceId,
    refetchInterval: 10000,
  });
  const creator = useQuery({
    queryKey: ["creator", "status", viewer?.id],
    queryFn: composerService.fetchMyCreatorStatus,
    enabled: !!viewer && creating,
  });

  const space = detail.data;
  const host = space?.host.id === viewer?.id;
  useEffect(() => {
    if (!spaceId || !grant || space?.state !== "live") return;
    let cancelled = false;
    const renew = async () => {
      try {
        const fresh = await spacesService.join(spaceId);
        if (!cancelled && (fresh.role !== grant.role || fresh.canPublish !== grant.canPublish)) {
          setGrant(fresh);
        }
      } catch {
        if (!cancelled) void client.invalidateQueries({ queryKey: ["spaces", spaceId] });
      }
    };
    if (space.viewerRole && space.viewerRole !== grant.role) void renew();
    const timer = setInterval(() => void renew(), 45000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [spaceId, space?.state, space?.viewerRole, grant, client]);

  const audio = useSpaceAudio(
    grant && space?.state === "live" && (!space.viewerRole || space.viewerRole === grant.role)
      ? grant
      : null,
  );

  useEffect(() => {
    if (!spaceId) return;
    return () => {
      void spacesService.action(spaceId, "leave").catch(() => undefined);
    };
  }, [spaceId]);

  const act = async (fn: () => Promise<unknown>, success = "") => {
    setBusy(true);
    setMessage("");
    try {
      const outcome = await fn();
      if (outcome === false) return;
      setMessage(success);
      await client.invalidateQueries({ queryKey: ["spaces"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't complete this action. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const join = () => act(async () => setGrant(await spacesService.join(spaceId!)));
  const publish = () => act(async () => {
    const post = await spacesService.announce(space!);
    setAnnouncement(post.id);
    await spacesService.attachAnnouncement(spaceId!, post.id);
    await client.invalidateQueries({ queryKey: ["feed"] });
  }, "Announcement published. Replies stay on the announcement post.");

  const createSpace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void act(async () => {
      const scheduledAt = schedule ? new Date(schedule).toISOString() : undefined;
      if (!creation.current.space && scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) {
        throw new Error("Choose a future date and time.");
      }

      let created: Space;
      try {
        created = await completeSpaceCreation(
          creation.current,
          () => spacesService.create({
            title: title.trim(),
            description: description.trim(),
            giftsEnabled: coinDonationsEnabled,
            scheduledAt,
          }, creation.current.key),
          spacesService.announce,
          (createdSpace, postId) => spacesService.attachAnnouncement(createdSpace.id, postId),
        );
      } catch (error) {
        if (creation.current.space) {
          setCanRetryAnnouncement(true);
          throw new Error(
            "Your Space was created, but its announcement is not finished. Choose Retry announcement to continue. " +
              (error instanceof Error ? error.message : ""),
            { cause: error },
          );
        }
        throw error;
      }

      await client.invalidateQueries({ queryKey: ["feed"] });
      router.push(`/spaces/${created.id}`);
    });
  };

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <Link href="/spaces">Nantty Spaces</Link>
        {!creating ? <Link href="/create/space" className={styles.secondary}>Create a Space</Link> : null}
      </header>
      {message ? <p role="status" className={styles.notice}>{message}</p> : null}

      {creating ? (
        <SpaceCreationPanel
          viewerSignedIn={!!viewer}
          creatorPending={creator.isPending}
          creatorError={creator.isError}
          creatorApproved={creator.data?.status === "approved"}
          onRetryCreatorCheck={() => void creator.refetch()}
          title={title}
          onTitleChange={setTitle}
          description={description}
          onDescriptionChange={setDescription}
          schedule={schedule}
          onScheduleChange={setSchedule}
          coinDonationsEnabled={coinDonationsEnabled}
          onCoinDonationsChange={setCoinDonationsEnabled}
          busy={busy}
          canRetryAnnouncement={canRetryAnnouncement}
          onSubmit={createSpace}
        />
      ) : spaceId ? (
        <>
          {detail.isPending ? <p role="status">Loading Space…</p> : null}
          {detail.isError ? (
            <div>
              <p role="alert">Couldn’t load this Space.</p>
              <button className={styles.secondary} onClick={() => void detail.refetch()}>Try again</button>
            </div>
          ) : null}
          {space ? (
            <SpaceRoomPanel
              space={space}
              spaceId={spaceId}
              host={!!host}
              busy={busy}
              grant={grant}
              audio={audio}
              announcement={announcement}
              onAction={act}
              onJoin={join}
              onPublish={publish}
              onGrantChange={setGrant}
            />
          ) : null}
        </>
      ) : (
        <>
          {list.isPending ? <p role="status">Finding Spaces…</p> : null}
          {list.isError ? (
            <div>
              <p role="alert">Couldn’t load Spaces.</p>
              <button className={styles.secondary} onClick={() => void list.refetch()}>Try again</button>
            </div>
          ) : null}
          {list.data ? <SpacesDirectoryPanel spaces={list.data} /> : null}
        </>
      )}
    </section>
  );
}
