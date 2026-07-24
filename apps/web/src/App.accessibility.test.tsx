// @vitest-environment jsdom

import axe from "axe-core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatView } from "./App.js";

describe("core chat accessibility", () => {
  it("has no automated axe violations in the ready room flow", async () => {
    document.body.innerHTML = renderToStaticMarkup(
      <ChatView
        room={{ roomId: "room-1", title: "Roundtable", version: 1 }}
        rooms={[{ roomId: "room-1", title: "Roundtable", version: 1 }]}
        messages={[
          {
            messageId: "message-1",
            authorParticipantId: "owner",
            kind: "human",
            body: "@fakeA hello",
            incomplete: false,
            runId: null,
            roomSequence: 4,
          },
        ]}
        draft="@fakeA "
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

    const results = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("sends with Enter while preserving Shift+Enter for a newline", () => {
    const container = document.createElement("div");
    document.body.replaceChildren(container);
    const onSubmit = vi.fn();
    const root = createRoot(container);
    act(() => {
      root.render(
        <ChatView
          room={{ roomId: "room-1", title: "Roundtable", version: 1 }}
          rooms={[{ roomId: "room-1", title: "Roundtable", version: 1 }]}
          messages={[]}
          draft="@fakeA hello"
          sending={false}
          onDraftChange={() => undefined}
          onSubmit={onSubmit}
          onInspectContext={() => undefined}
          onSelectRoom={() => undefined}
          activeRuns={[]}
          onStopRun={() => undefined}
          onRetryRun={() => undefined}
          streamingTextByRun={{}}
          onCreateRoom={() => undefined}
        />,
      );
    });
    const composer = container.querySelector("textarea");
    expect(composer).not.toBeNull();
    composer?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(onSubmit).not.toHaveBeenCalled();
    composer?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(onSubmit).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });
});
