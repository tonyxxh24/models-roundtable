import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatView, ReadinessView } from "./App.js";

describe("ReadinessView", () => {
  it("communicates ready status accessibly", () => {
    const html = renderToStaticMarkup(<ReadinessView state="ready" />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Protocol version 1");
  });

  it("communicates local connection failures accessibly", () => {
    const html = renderToStaticMarkup(
      <ReadinessView state="error" detail="connection refused" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("connection refused");
  });
});

describe("ChatView", () => {
  it("renders a keyboard-reachable composer and attributed timeline", () => {
    const html = renderToStaticMarkup(
      <ChatView
        room={{ roomId: "room-1", title: "Roundtable", version: 1 }}
        rooms={[{ roomId: "room-1", title: "Roundtable", version: 1 }]}
        messages={[
          {
            messageId: "message-1",
            authorParticipantId: "owner",
            kind: "human",
            body: "@all hello",
            incomplete: false,
            runId: null,
            roomSequence: 2,
          },
        ]}
        draft="@all "
        sending={false}
        onDraftChange={() => undefined}
        onSubmit={() => undefined}
        onInspectContext={() => undefined}
        onSelectRoom={() => undefined}
        activeRuns={[]}
        onStopRun={() => undefined}
        onRetryRun={() => undefined}
        streamingTextByRun={{}}
        onCreateRoom={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Room timeline"');
    expect(html).toContain('for="composer"');
    expect(html).toContain('type="submit"');
    expect(html).toContain("@owner");
    expect(html).toContain('aria-label="Run context inspector"');
    expect(html).toContain('aria-label="Rooms"');
    expect(html).toContain("New room");
  });

  it("renders an inspectable, source-based context manifest", () => {
    const html = renderToStaticMarkup(
      <ChatView
        room={{ roomId: "room-1", title: "Roundtable", version: 1 }}
        rooms={[{ roomId: "room-1", title: "Roundtable", version: 1 }]}
        messages={[]}
        draft="@all "
        sending={false}
        onDraftChange={() => undefined}
        onSubmit={() => undefined}
        onInspectContext={() => undefined}
        onSelectRoom={() => undefined}
        activeRuns={[
          {
            runId: "run-active",
            targetHandle: "fakeB",
            state: "running",
          },
        ]}
        onStopRun={() => undefined}
        onRetryRun={() => undefined}
        streamingTextByRun={{ "run-active": "Streaming preview" }}
        onCreateRoom={() => undefined}
        context={{
          runId: "run-1",
          targetHandle: "fakeA",
          state: "completed",
          contextSnapshotId: "snapshot-1",
          manifest: {
            roomSequence: 4,
            mode: "new",
            messageIds: ["message-1"],
            replyMessageIds: [],
            instructionRefs: [],
            skillRefs: [],
            attachmentIds: [],
            truncations: [],
            estimatedCharacters: 10,
          },
        }}
      />,
    );
    expect(html).toContain("@fakeA");
    expect(html).toContain("message-1");
    expect(html).toContain("Captured room sequence");
    expect(html).toContain("Stop");
    expect(html).toContain("Streaming preview");
  });
});
