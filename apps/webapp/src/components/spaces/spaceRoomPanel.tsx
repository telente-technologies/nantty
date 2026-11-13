import Link from "next/link";

import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { Avatar } from "@/components/ui/media";
import { spacesService, type Space, type SpaceGrant } from "@/services/spaces.service";

import { SpaceCoinDonationPanel } from "./spaceCoinDonationPanel";
import { useSpaceAudio } from "./spaceAudio.hook";
import styles from "./spaces.module.css";

type SpaceAudio = ReturnType<typeof useSpaceAudio>;
type SpaceAction = (action: () => Promise<unknown>, success?: string) => Promise<void>;

interface SpaceRoomPanelProps {
  readonly space: Space;
  readonly spaceId: string;
  readonly host: boolean;
  readonly busy: boolean;
  readonly grant: SpaceGrant | null;
  readonly audio: SpaceAudio;
  readonly announcement: string | null;
  readonly onAction: SpaceAction;
  readonly onJoin: () => Promise<void>;
  readonly onPublish: () => Promise<void>;
  readonly onGrantChange: (grant: SpaceGrant | null) => void;
}

export function SpaceRoomPanel({
  space,
  spaceId,
  host,
  busy,
  grant,
  audio,
  announcement,
  onAction,
  onJoin,
  onPublish,
  onGrantChange,
}: SpaceRoomPanelProps) {
  return (
    <>
      <span className={styles.pill}>
        {space.state === "live" ? "SPACE · LIVE AUDIO" : space.state.toUpperCase()}
      </span>
      <div className={styles.spaceTitleRow}>
        <h1>{space.title}</h1>
        <ContentActionsMenu
          shareKind={null}
          reportTargetType="space"
          targetId={space.id}
          canonicalPath={`/spaces/${encodeURIComponent(space.id)}`}
          isOwnContent={host}
        />
      </div>
      <p className={styles.muted}>{space.description}</p>
      {space.scheduledAt && space.state === "scheduled" ? (
        <p>Starts {new Date(space.scheduledAt).toLocaleString()}</p>
      ) : null}

      <div className={styles.stage}>
        <div className={styles.stageHeading}>
          <h2>On stage</h2>
          <span className={styles.muted}>{space.listenerCount} listening</span>
        </div>
        <div className={styles.stageGrid}>
          {[space.host, ...(space.speakers ?? [])].map((person) => (
            <div key={person.id} className={styles.stagePerson}>
              <span className={person.role === "host" ? styles.hostRing : styles.speakerRing}>
                <Avatar name={person.name || "Space host"} src={person.avatarUrl} size="xl" />
              </span>
              <strong>{person.name || "Space host"}</strong>
              <span className={styles.muted}>
                {person.role === "host" ? "Host" : person.muted ? "Speaker · muted" : "Speaker"}
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
        <summary>{host ? "Manage speakers" : "People on stage"}</summary>
        {[space.host, ...(space.speakers ?? [])].map((person) => (
          <div key={person.id} className={styles.person}>
            <span className={styles.avatar}>{(person.name || "Host").slice(0, 1)}</span>
            <div className={styles.copy}>
              <strong>{person.name || "Space host"}</strong>
              <span className={styles.muted}>{person.role}{person.muted ? " · muted" : ""}</span>
            </div>
            {host && person.role === "speaker" ? (
              <div className={styles.actions}>
                {(["mute", "demote", "remove"] as const).map((action) => (
                  <button
                    key={action}
                    disabled={busy}
                    className={styles.secondary}
                    onClick={() => void onAction(() => spacesService.action(
                      spaceId,
                      `speakers/${encodeURIComponent(person.id)}/${action}`,
                    ))}
                  >
                    {action === "mute" ? "Mute" : action === "demote" ? "Move to listeners" : "Remove"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </details>

      <div className={styles.audioControls} aria-label="Audio controls">
        {space.state === "live" && !grant ? (
          <button disabled={busy} className={styles.button} onClick={() => void onJoin()}>
            {host ? "Connect host audio" : "Join as listener"}
          </button>
        ) : null}
        {audio.status === "playback" ? (
          <button className={styles.button} onClick={() => void onAction(audio.resume)}>Play audio</button>
        ) : null}
        {["failed", "disconnected"].includes(audio.status) ? (
          <button className={styles.secondary} onClick={() => void onJoin()}>Reconnect audio</button>
        ) : null}
        {grant?.canPublish && audio.status === "connected" ? (
          <button className={styles.secondary} onClick={() => void onAction(audio.toggle)}>
            {audio.muted ? "Unmute microphone" : "Mute microphone"}
          </button>
        ) : null}
        {grant && !host ? (
          <button
            disabled={busy}
            className={styles.secondary}
            onClick={() => void onAction(async () => {
              await spacesService.action(spaceId, "leave");
              onGrantChange(null);
            })}
          >
            Leave Space
          </button>
        ) : null}
        {grant?.role === "listener" ? (
          <button
            disabled={busy}
            className={styles.secondary}
            onClick={() => void onAction(
              () => spacesService.action(spaceId, "speaker-requests"),
              "Your microphone request was sent to the host.",
            )}
          >
            Request microphone
          </button>
        ) : null}
        {host && space.state === "scheduled" ? (
          <button
            disabled={busy}
            className={styles.button}
            onClick={() => void onAction(async () => {
              await spacesService.action(spaceId, "start");
              onGrantChange(await spacesService.join(spaceId));
            })}
          >
            Start now
          </button>
        ) : null}
      </div>

      {space.state === "live" && space.giftsEnabled && grant && !host ? (
        <SpaceCoinDonationPanel spaceId={space.id} hostName={space.host.name || "the host"} />
      ) : null}

      {host ? (
        <details className={styles.management}>
          <summary>Manage Space</summary>
          <div className={styles.actions}>
            {space.state === "live" ? (
              <label className={styles.coinSupportChoice}>
                <input
                  type="checkbox"
                  checked={space.giftsEnabled === true}
                  disabled={busy}
                  onChange={(event) => void onAction(
                    () => spacesService.setCoinDonations(spaceId, event.target.checked),
                  )}
                />
                Allow listeners to support you with coins
              </label>
            ) : null}
            {!space.announcementPostId && ["live", "scheduled"].includes(space.state) ? (
              <button disabled={busy} className={styles.secondary} onClick={() => void onPublish()}>
                Post announcement
              </button>
            ) : null}
            {["live", "scheduled"].includes(space.state) ? (
              <button
                disabled={busy}
                className={styles.secondary}
                onClick={() => {
                  if (window.confirm(space.state === "live" ? "End this Space for everyone?" : "Cancel this Space?")) {
                    void onAction(() => spacesService.action(
                      spaceId,
                      space.state === "live" ? "end" : "cancel",
                    ));
                  }
                }}
              >
                {space.state === "live" ? "End Space" : "Cancel Space"}
              </button>
            ) : null}
          </div>
        </details>
      ) : null}

      {host ? space.pendingSpeakerRequests?.map((request) => (
        <div className={styles.card} key={request.id}>
          <span>{request.user.name} wants to speak</span>
          <button
            disabled={busy}
            className={styles.secondary}
            onClick={() => void onAction(() => spacesService.action(
              spaceId,
              `speaker-requests/${request.id}/approve`,
            ))}
          >
            Approve
          </button>
          <button
            disabled={busy}
            className={styles.secondary}
            onClick={() => void onAction(() => spacesService.action(
              spaceId,
              `speaker-requests/${request.id}/decline`,
            ))}
          >
            Decline
          </button>
        </div>
      )) : null}

      <p className={styles.muted}>
        {announcement || space.announcementPostId ? (
          <Link href={`/post/${announcement || space.announcementPostId}#comments`}>
            Open announcement and comments
          </Link>
        ) : (
          "Comments live on the host’s announcement post in the feed."
        )}
      </p>
    </>
  );
}
