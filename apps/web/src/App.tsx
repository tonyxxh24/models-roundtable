import {
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import {
  bootstrapSession,
  cancelRun,
  connectRoomRealtime,
  createRoom,
  fetchActiveRuns,
  fetchCodexReadiness,
  fetchHealth,
  fetchMessages,
  fetchRunContext,
  listRooms,
  retryRun,
  sendMessage,
  type ActiveRun,
  type ProviderReadiness,
  type RoomMessage,
  type RoomSummary,
  type RunContext,
} from "./api.js";

export type ReadinessState = "loading" | "ready" | "error";

export interface ReadinessViewProps {
  readonly state: ReadinessState;
  readonly detail?: string | undefined;
}

export function ReadinessView({
  state,
  detail,
}: ReadinessViewProps): ReactElement {
  return (
    <main>
      <h1>Models Roundtable</h1>
      <p role={state === "error" ? "alert" : "status"}>
        {state === "loading" && "Checking the local server…"}
        {state === "ready" &&
          "Local server ready. Protocol version 1 is available."}
        {state === "error" &&
          "Local server is unavailable: " + (detail ?? "unknown error") + "."}
      </p>
    </main>
  );
}

export interface ChatViewProps {
  readonly room: RoomSummary;
  readonly rooms: readonly RoomSummary[];
  readonly messages: readonly RoomMessage[];
  readonly draft: string;
  readonly sending: boolean;
  readonly onDraftChange: (draft: string) => void;
  readonly onSubmit: () => void;
  readonly context?: RunContext | undefined;
  readonly onInspectContext: (runId: string) => void;
  readonly onSelectRoom: (room: RoomSummary) => void;
  readonly activeRuns: readonly ActiveRun[];
  readonly onStopRun: (runId: string) => void;
  readonly onRetryRun: (runId: string) => void;
  readonly streamingTextByRun: Readonly<Record<string, string>>;
  readonly onCreateRoom: () => void;
  readonly codexReadiness?: ProviderReadiness | undefined;
}

export function ChatView({
  room,
  rooms,
  messages,
  draft,
  sending,
  onDraftChange,
  onSubmit,
  context,
  onInspectContext,
  onSelectRoom,
  activeRuns,
  onStopRun,
  onRetryRun,
  streamingTextByRun,
  onCreateRoom,
  codexReadiness,
}: ChatViewProps): ReactElement {
  return (
    <main className="chat-layout">
      <nav aria-label="Rooms">
        <h2>Rooms</h2>
        <button type="button" onClick={onCreateRoom}>
          New room
        </button>
        <ul>
          {rooms.map((candidate) => (
            <li key={candidate.roomId}>
              <button
                type="button"
                aria-current={
                  candidate.roomId === room.roomId ? "page" : undefined
                }
                onClick={() => onSelectRoom(candidate)}
              >
                {candidate.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="chat">
        <header>
          <p className="eyebrow">Local deterministic room</p>
          <h1>{room.title}</h1>
          <p>Participants: @owner, @fakeA, @fakeB, @all</p>
          <p role="status">
            Codex: {codexReadiness?.health ?? "checking"}
            {codexReadiness?.providerVersion === undefined
              ? ""
              : " (" + codexReadiness.providerVersion + ")"}
            {codexReadiness === undefined
              ? ""
              : " — " + codexReadiness.safeMessage}
          </p>
          <div role="status" aria-live="polite" aria-label="Active runs">
            {activeRuns.map((run) => (
              <p key={run.runId}>
                @{run.targetHandle}: {run.state}{" "}
                <button type="button" onClick={() => onStopRun(run.runId)}>
                  Stop
                </button>
                {streamingTextByRun[run.runId] !== undefined && (
                  <span> {streamingTextByRun[run.runId]}</span>
                )}
              </p>
            ))}
          </div>
        </header>
        <section aria-label="Room timeline" aria-live="polite">
          {messages.length === 0 ? (
            <p>No messages yet. Address @fakeA, @fakeB, or @all.</p>
          ) : (
            <ol className="timeline">
              {messages.map((message) => (
                <li key={message.messageId}>
                  <strong>
                    {message.kind === "human" ? "@owner" : "@fake"}
                  </strong>
                  <p>{message.body}</p>
                  {message.incomplete && <span>Partial response</span>}
                  {message.runId !== null && (
                    <button
                      type="button"
                      onClick={() => onInspectContext(message.runId as string)}
                    >
                      Inspect context
                    </button>
                  )}
                  {message.incomplete && message.runId !== null && (
                    <button
                      type="button"
                      onClick={() => onRetryRun(message.runId as string)}
                    >
                      Retry
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label htmlFor="composer">Message</label>
          <textarea
            id="composer"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder="@all explain this"
            rows={4}
            aria-describedby="composer-help"
          />
          <p id="composer-help">
            Enter sends; Shift+Enter adds a line. Type @ for participants. No
            skills are available yet for $ in fake-provider mode.
          </p>
          <button type="submit" disabled={sending || draft.trim().length === 0}>
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
      <aside aria-label="Run context inspector">
        <h2>Run context</h2>
        {context === undefined ? (
          <p>Select an agent response to inspect exactly what it received.</p>
        ) : (
          <dl>
            <dt>Agent</dt>
            <dd>@{context.targetHandle}</dd>
            <dt>State</dt>
            <dd>{context.state}</dd>
            <dt>Mode</dt>
            <dd>{context.manifest.mode}</dd>
            <dt>Captured room sequence</dt>
            <dd>{context.manifest.roomSequence}</dd>
            <dt>Source message IDs</dt>
            <dd>{context.manifest.messageIds.join(", ") || "None"}</dd>
            <dt>Truncations</dt>
            <dd>{context.manifest.truncations.join(", ") || "None"}</dd>
          </dl>
        )}
      </aside>
    </main>
  );
}

export default function App(): ReactElement {
  const [state, setState] = useState<ReadinessState>("loading");
  const [detail, setDetail] = useState<string>();
  const [room, setRoom] = useState<RoomSummary>();
  const [rooms, setRooms] = useState<readonly RoomSummary[]>([]);
  const [messages, setMessages] = useState<readonly RoomMessage[]>([]);
  const [draft, setDraft] = useState("@all ");
  const [sending, setSending] = useState(false);
  const [context, setContext] = useState<RunContext>();
  const [activeRuns, setActiveRuns] = useState<readonly ActiveRun[]>([]);
  const [streamingTextByRun, setStreamingTextByRun] = useState<
    Readonly<Record<string, string>>
  >({});
  const [codexReadiness, setCodexReadiness] = useState<ProviderReadiness>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await fetchHealth();
        await bootstrapSession();
        const [rooms, codex] = await Promise.all([
          listRooms(),
          fetchCodexReadiness(),
        ]);
        const selected = rooms[0] ?? (await createRoom("First roundtable"));
        const timeline = await fetchMessages(selected.roomId);
        const running = await fetchActiveRuns(selected.roomId);
        if (active) {
          setRooms(rooms.length === 0 ? [selected] : rooms);
          setRoom(selected);
          setMessages(timeline);
          setActiveRuns(running);
          setCodexReadiness(codex);
          setState("ready");
        }
      } catch (error: unknown) {
        if (active) {
          setDetail(error instanceof Error ? error.message : "unknown error");
          setState("error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (room === undefined) {
      return;
    }
    const latestMessageSequence = messages.reduce(
      (latest, message) => Math.max(latest, message.roomSequence),
      0,
    );
    return connectRoomRealtime(
      room.roomId,
      latestMessageSequence,
      (event) => {
        if (
          event.type === "run.text_delta" &&
          event.runId !== undefined &&
          typeof event.payload?.text === "string"
        ) {
          setStreamingTextByRun((current) => ({
            ...current,
            [event.runId as string]:
              (current[event.runId as string] ?? "") + event.payload?.text,
          }));
        }
        if (event.type === "message.created") {
          void fetchMessages(room.roomId)
            .then(setMessages)
            .catch(() => undefined);
        }
        if (event.type.startsWith("run.")) {
          void fetchActiveRuns(room.roomId)
            .then(setActiveRuns)
            .catch(() => undefined);
        }
        if (
          ["run.completed", "run.failed", "run.cancelled"].includes(
            event.type,
          ) &&
          event.runId !== undefined
        ) {
          setStreamingTextByRun((current) => {
            const next = { ...current };
            delete next[event.runId as string];
            return next;
          });
        }
      },
      () => undefined,
    );
  }, [room?.roomId]);

  async function submit(): Promise<void> {
    if (room === undefined || draft.trim().length === 0 || sending) {
      return;
    }
    setSending(true);
    try {
      await sendMessage(room.roomId, draft);
      const [timeline, running] = await Promise.all([
        fetchMessages(room.roomId),
        fetchActiveRuns(room.roomId),
      ]);
      setMessages(timeline);
      setActiveRuns(running);
      setDraft("@all ");
    } catch (error: unknown) {
      setDetail(error instanceof Error ? error.message : "unknown error");
      setState("error");
    } finally {
      setSending(false);
    }
  }

  if (state !== "ready" || room === undefined) {
    return <ReadinessView state={state} detail={detail} />;
  }
  return (
    <ChatView
      room={room}
      rooms={rooms}
      messages={messages}
      draft={draft}
      sending={sending}
      onDraftChange={setDraft}
      onSubmit={() => void submit()}
      context={context}
      onInspectContext={(runId) => {
        void fetchRunContext(runId)
          .then(setContext)
          .catch((error: unknown) => {
            setDetail(error instanceof Error ? error.message : "unknown error");
          });
      }}
      onSelectRoom={(selectedRoom) => {
        setRoom(selectedRoom);
        setContext(undefined);
        void Promise.all([
          fetchMessages(selectedRoom.roomId),
          fetchActiveRuns(selectedRoom.roomId),
        ])
          .then(([timeline, running]) => {
            setMessages(timeline);
            setActiveRuns(running);
          })
          .catch((error: unknown) => {
            setDetail(error instanceof Error ? error.message : "unknown error");
          });
      }}
      activeRuns={activeRuns}
      streamingTextByRun={streamingTextByRun}
      onStopRun={(runId) => {
        void cancelRun(runId)
          .then(async () => {
            const [timeline, running] = await Promise.all([
              fetchMessages(room.roomId),
              fetchActiveRuns(room.roomId),
            ]);
            setMessages(timeline);
            setActiveRuns(running);
          })
          .catch((error: unknown) => {
            setDetail(error instanceof Error ? error.message : "unknown error");
          });
      }}
      onRetryRun={(runId) => {
        void retryRun(runId)
          .then(async () => {
            const timeline = await fetchMessages(room.roomId);
            setMessages(timeline);
          })
          .catch((error: unknown) => {
            setDetail(error instanceof Error ? error.message : "unknown error");
          });
      }}
      onCreateRoom={() => {
        void createRoom("Roundtable " + (rooms.length + 1))
          .then(async (createdRoom) => {
            setRooms((current) => [createdRoom, ...current]);
            setRoom(createdRoom);
            setMessages(await fetchMessages(createdRoom.roomId));
            setActiveRuns([]);
            setContext(undefined);
          })
          .catch((error: unknown) => {
            setDetail(error instanceof Error ? error.message : "unknown error");
          });
      }}
      codexReadiness={codexReadiness}
    />
  );
}
