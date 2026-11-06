"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers/sessionProvider";
import { composerService } from "@/services/composer.service";
import { createIdempotencyKey } from "@/services/clientApi.service";
import { spacesService, type SpaceGrant } from "@/services/spaces.service";
import { useSpaceAudio } from "./spaceAudio.hook";
import styles from "./spaces.module.css";
import { Avatar } from "@/components/ui/media";
import { completeSpaceCreation, type SpaceCreationCheckpoint } from "@/utils/spaceCreation.util";
import type { Space } from "@/services/spaces.service";
import { SpaceCoinDonationPanel } from "./spaceCoinDonationPanel";

export function Spaces({
  spaceId,
  creating = false,
}: {
  spaceId?: string;
  creating?: boolean;
}) {
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
  const [grant, setGrant] = useState<SpaceGrant | null>(null);
  const creation = useRef<SpaceCreationCheckpoint<Space>>({key:createIdempotencyKey("space")});
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
        if (
          !cancelled &&
          (fresh.role !== grant.role || fresh.canPublish !== grant.canPublish)
        )
          setGrant(fresh);
      } catch {
        if (!cancelled)
          void client.invalidateQueries({ queryKey: ["spaces", spaceId] });
      }
    };
    if (space.viewerRole && space.viewerRole !== grant.role) void renew();
    const timer = setInterval(() => {
      void renew();
    }, 45000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [spaceId, space?.state, space?.viewerRole, grant, client]);
  const audio = useSpaceAudio(
    grant &&
      space?.state === "live" &&
      (!space.viewerRole || space.viewerRole === grant.role)
      ? grant
      : null,
  );
  useEffect(() => {
    setGrant(null);
    setAnnouncement(null);
    setMessage("");
  }, [spaceId]);
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
      setMessage(
        error instanceof Error
          ? error.message
          : "Couldn't complete this action. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const join = () =>
    act(async () => setGrant(await spacesService.join(spaceId!)));
  const publish = () =>
    act(async () => {
      const post = await spacesService.announce(space!);
      setAnnouncement(post.id);
      await spacesService.attachAnnouncement(spaceId!, post.id);
      await client.invalidateQueries({ queryKey: ["feed"] });
    }, "Announcement published. Replies stay on the announcement post.");
  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <Link href="/spaces">Nantty Spaces</Link>
        {!creating && (
          <Link href="/create/space" className={styles.secondary}>
            Create a Space
          </Link>
        )}
      </header>
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {creating ? (
        <>
          <h1>A conversation worth joining</h1>
          <p className={styles.muted}>
            Creators host. Everyone can listen. Start an audio Space now or
            schedule one for later.
          </p>
          {!viewer ? (
            <Link href="/login">Sign in to host</Link>
          ) : creator.isPending ? (
            <p>Checking creator access…</p>
          ) : creator.isError ? (
            <button
              className={styles.secondary}
              onClick={() => creator.refetch()}
            >
              Retry creator check
            </button>
          ) : creator.data?.status !== "approved" ? (
            <Link href="/creator/program">
              Join the Creator Program to host
            </Link>
          ) : (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                void act(async () => {
                  const scheduledAt = schedule
                    ? new Date(schedule).toISOString()
                    : undefined;
                  if (
                    !creation.current.space && scheduledAt &&
                    new Date(scheduledAt).getTime() <= Date.now()
                  )
                    throw new Error("Choose a future date and time.");
                  let created: Space;
                  try { created = await completeSpaceCreation(creation.current, () => spacesService.create({
                    title: title.trim(),
                    description: description.trim(),
                    giftsEnabled: coinDonationsEnabled,
                    scheduledAt,
                  },creation.current.key), spacesService.announce, (space,postId)=>spacesService.attachAnnouncement(space.id,postId));
                  } catch (error) { if (creation.current.space) throw new Error("Your Space was created, but its announcement is not finished. Choose Retry announcement to continue. " + (error instanceof Error ? error.message : "")); throw error; }
                  await client.invalidateQueries({queryKey:["feed"]});
                  router.push(`/spaces/${created.id}`);
                });
              }}
            >
              <label>
                Title
                <input
                  required
                  disabled={busy || !!creation.current.space}
                  maxLength={80}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="What are you talking about?"
                />
              </label>
              <label>
                Description (optional)
                <textarea
                  maxLength={500}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Add a little context"
                />
              </label>
              <label>
                Schedule (optional)
                <input
                  type="datetime-local"
                  value={schedule}
                  onChange={(event) => setSchedule(event.target.value)}
                />
              </label>
              <label className={styles.coinSupportChoice}>
                <input
                  type="checkbox"
                  checked={coinDonationsEnabled}
                  onChange={(event) => setCoinDonationsEnabled(event.target.checked)}
                />
                Allow listeners to support you with coins
              </label>
              <p className={styles.muted}>
                Times use your local timezone. Leave blank to start now. Anyone
                can join this public Space.
              </p>
              <button
                className={styles.button}
                disabled={busy || !title.trim()}
              >
                {busy
                  ? "Publishing…"
                  : creation.current.space ? "Retry announcement" : schedule
                    ? "Schedule Space"
                    : "Start Space"}
              </button>
            </form>
          )}
        </>
      ) : spaceId ? (
        <>
          {detail.isPending && <p role="status">Loading Space…</p>}
          {detail.isError && (
            <>
              <p role="alert">Couldn't load this Space.</p>
              <button
                className={styles.secondary}
                onClick={() => detail.refetch()}
              >
                Try again
              </button>
            </>
          )}
          {space && (
            <>
              <span className={styles.pill}>
                {space.state === "live"
                  ? "SPACE · LIVE AUDIO"
                  : space.state.toUpperCase()}
              </span>
              <h1>{space.title}</h1>
              <p className={styles.muted}>{space.description}</p>
              {space.scheduledAt && space.state === "scheduled" && (
                <p>Starts {new Date(space.scheduledAt).toLocaleString()}</p>
              )}
              <div className={styles.stage}>
                <div className={styles.stageHeading}>
                  <h2>On stage</h2>
                  <span className={styles.muted}>
                    {space.listenerCount} listening
                  </span>
                </div>
                <div className={styles.stageGrid}>
                  {[space.host, ...(space.speakers ?? [])].map((person) => (
                    <div key={person.id} className={styles.stagePerson}>
                      <span
                        className={
                          person.role === "host"
                            ? styles.hostRing
                            : styles.speakerRing
                        }
                      >
                        <Avatar
                          name={person.name || "Space host"}
                          src={person.avatarUrl}
                          size="xl"
                        />
                      </span>
                      <strong>{person.name || "Space host"}</strong>
                      <span className={styles.muted}>
                        {person.role === "host"
                          ? "Host"
                          : person.muted
                            ? "Speaker · muted"
                            : "Speaker"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className={styles.muted}>
                  {audio.status === "demo"
                    ? "Demo Space · audio is a preview"
                    : audio.status === "connected"
                      ? "Connected to live audio"
                      : audio.status === "idle"
                        ? "Audio conversation · camera is not used"
                        : `Audio: ${audio.status}`}
                </p>
              </div>
              <details className={styles.management}>
                <summary>
                  {host ? "Manage speakers" : "People on stage"}
                </summary>
                {[space.host, ...(space.speakers ?? [])].map((person) => (
                  <div key={person.id} className={styles.person}>
                    <span className={styles.avatar}>
                      {(person.name || "Host").slice(0, 1)}
                    </span>
                    <div className={styles.copy}>
                      <strong>{person.name || "Space host"}</strong>
                      <span className={styles.muted}>
                        {person.role}
                        {person.muted ? " · muted" : ""}
                      </span>
                    </div>
                    {host && person.role === "speaker" && (
                      <div className={styles.actions}>
                        {(["mute", "demote", "remove"] as const).map(
                          (action) => (
                            <button
                              key={action}
                              disabled={busy}
                              className={styles.secondary}
                              onClick={() =>
                                act(() =>
                                  spacesService.action(
                                    spaceId,
                                    `speakers/${encodeURIComponent(person.id)}/${action}`,
                                  ),
                                )
                              }
                            >
                              {action === "mute"
                                ? "Mute"
                                : action === "demote"
                                  ? "Move to listeners"
                                  : "Remove"}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </details>
              <div className={styles.audioControls} aria-label="Audio controls">
                {space.state === "live" && !grant && (
                  <button
                    disabled={busy}
                    className={styles.button}
                    onClick={join}
                  >
                    {host ? "Connect host audio" : "Join as listener"}
                  </button>
                )}
                {audio.status === "playback" && (
                  <button
                    className={styles.button}
                    onClick={() => act(audio.resume)}
                  >
                    Play audio
                  </button>
                )}
                {["failed", "disconnected"].includes(audio.status) && (
                  <button className={styles.secondary} onClick={join}>
                    Reconnect audio
                  </button>
                )}
                {grant?.canPublish && audio.status === "connected" && (
                  <button
                    className={styles.secondary}
                    onClick={() => act(audio.toggle)}
                  >
                    {audio.muted ? "Unmute microphone" : "Mute microphone"}
                  </button>
                )}
                {grant && !host && (
                  <button
                    disabled={busy}
                    className={styles.secondary}
                    onClick={() =>
                      act(async () => {
                        await spacesService.action(spaceId, "leave");
                        setGrant(null);
                      })
                    }
                  >
                    Leave Space
                  </button>
                )}
                {grant && grant.role === "listener" && (
                  <button
                    disabled={busy}
                    className={styles.secondary}
                    onClick={() =>
                      act(
                        () => spacesService.action(spaceId, "speaker-requests"),
                        "Your microphone request was sent to the host.",
                      )
                    }
                  >
                    Request microphone
                  </button>
                )}
                {host && space.state === "scheduled" && (
                  <button
                    disabled={busy}
                    className={styles.button}
                    onClick={() =>
                      act(async () => {
                        await spacesService.action(spaceId, "start");
                        setGrant(await spacesService.join(spaceId));
                      })
                    }
                  >
                    Start now
                  </button>
                )}
              </div>
              {space.state === "live" && space.giftsEnabled && grant && !host && (
                <SpaceCoinDonationPanel spaceId={space.id} hostName={space.host.name || "the host"} />
              )}
              {host && (
                <details className={styles.management}>
                  <summary>Manage Space</summary>
                  <div className={styles.actions}>
                    {space.state === "live" && (
                      <label className={styles.coinSupportChoice}>
                        <input
                          type="checkbox"
                          checked={space.giftsEnabled === true}
                          disabled={busy}
                          onChange={(event) => void act(() => spacesService.setCoinDonations(spaceId, event.target.checked))}
                        />
                        Allow listeners to support you with coins
                      </label>
                    )}
                    {host &&
                      !space.announcementPostId &&
                      ["live", "scheduled"].includes(space.state) && (
                        <button
                          disabled={busy}
                          className={styles.secondary}
                          onClick={publish}
                        >
                          Post announcement
                        </button>
                      )}
                    {host && ["live", "scheduled"].includes(space.state) && (
                      <button
                        disabled={busy}
                        className={styles.secondary}
                        onClick={() => {
                          if (
                            window.confirm(
                              space.state === "live"
                                ? "End this Space for everyone?"
                                : "Cancel this Space?",
                            )
                          )
                            void act(() =>
                              spacesService.action(
                                spaceId,
                                space.state === "live" ? "end" : "cancel",
                              ),
                            );
                        }}
                      >
                        {space.state === "live" ? "End Space" : "Cancel Space"}
                      </button>
                    )}
                  </div>
                </details>
              )}
              {host &&
                space.pendingSpeakerRequests?.map((request) => (
                  <div className={styles.card} key={request.id}>
                    <span>{request.user.name} wants to speak</span>
                    <button
                      disabled={busy}
                      className={styles.secondary}
                      onClick={() =>
                        act(() =>
                          spacesService.action(
                            spaceId,
                            `speaker-requests/${request.id}/approve`,
                          ),
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      disabled={busy}
                      className={styles.secondary}
                      onClick={() =>
                        act(() =>
                          spacesService.action(
                            spaceId,
                            `speaker-requests/${request.id}/decline`,
                          ),
                        )
                      }
                    >
                      Decline
                    </button>
                  </div>
                ))}
              <p className={styles.muted}>
                {announcement || space.announcementPostId ? (
                  <Link
                    href={`/post/${announcement || space.announcementPostId}#comments`}
                  >
                    Open announcement and comments
                  </Link>
                ) : (
                  "Comments live on the host’s announcement post in the feed."
                )}
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <h1>Make room for conversation</h1>
          <p className={styles.muted}>
            Drop into live audio or find your next conversation. Creators host;
            anyone can listen.
          </p>
          {list.isPending && <p role="status">Finding Spaces…</p>}
          {list.isError && (
            <>
              <p role="alert">Couldn't load Spaces.</p>
              <button
                className={styles.secondary}
                onClick={() => list.refetch()}
              >
                Try again
              </button>
            </>
          )}
          {list.data?.length === 0 && (
            <p>No Spaces yet. Start a conversation or check back soon.</p>
          )}
          {(["live", "scheduled"] as const).map((state) => (
            <section key={state}>
              <h2>{state === "live" ? "Live now" : "Upcoming"}</h2>
              {list.data
                ?.filter((item) => item.state === state)
                .map((item) => (
                  <article key={item.id} className={styles.card}>
                    <div className={styles.copy}>
                      <span className={styles.pill}>
                        {state === "live" ? "LIVE AUDIO" : "SCHEDULED"}
                      </span>
                      <Link href={`/spaces/${item.id}`}>{item.title}</Link>
                      <span className={styles.muted}>
                        {item.host.name} ·{" "}
                        {state === "live"
                          ? `${item.listenerCount} listening`
                          : new Date(item.scheduledAt!).toLocaleString()}
                      </span>
                    </div>
                    <Link className={styles.button} href={`/spaces/${item.id}`}>
                      {state === "live" ? "Join Space" : "View Space"}
                    </Link>
                  </article>
                ))}
            </section>
          ))}
        </>
      )}
    </section>
  );
}
