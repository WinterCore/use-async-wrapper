import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AsyncData, useAsyncWrapper } from "../src";
import {
  Btn,
  ButtonRow,
  Demo,
  ErrorBanner,
  mockUsers,
  Spinner,
  StatePanel,
  type User,
} from "./helpers";

const meta = {
  title: "AsyncData/Cancellation",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------

/** Fake fetch: resolves after `ms` unless the signal aborts first. */
const fakeFetchUsers = (signal: AbortSignal, ms: number) =>
  new Promise<User[]>((resolve, reject) => {
    const timer = setTimeout(() => resolve(mockUsers), ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

const AbortDemo = () => {
  const [users, setUsers] = React.useState(new AsyncData<User[]>());
  const [log, setLog] = React.useState<string[]>([]);

  const addLog = (line: string) =>
    setLog(prev => [line, ...prev.slice(0, 5)]);

  const fetchUsers = () => {
    // Cancel any in-flight request before starting a new one
    if (users.abortController) {
      users.abortController.abort();
      addLog("aborted previous in-flight request");
    }

    const controller = new AbortController();
    setUsers(prev => prev.withLoading(controller));
    addLog("started fetch (3s)");

    fakeFetchUsers(controller.signal, 3000)
      .then(data => {
        setUsers(prev => prev.withData(data));
        addLog("resolved");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setUsers(prev => prev.withError(String(err)));
        addLog("failed");
      });
  };

  const abort = () => {
    if (users.abortController) {
      users.abortController.abort();
      setUsers(prev => new AsyncData<User[]>({ data: prev.data })); // keep data, stop loading
      addLog("aborted by user");
    }
  };

  const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError, AsyncWrapperLoading } =
    useAsyncWrapper(users);

  return (
    <Demo
      intro={
        <>
          <code>withLoading(controller)</code> stores the request's{" "}
          <code>AbortController</code> on the state itself, so the next fetch — or an explicit
          cancel button — can abort the in-flight one. Press <em>fetch</em> twice quickly: the
          first request is aborted, no race.
        </>
      }
      controls={
        <ButtonRow>
          <Btn onClick={fetchUsers}>fetch (3s)</Btn>
          <Btn onClick={abort} disabled={!users.abortController}>
            abort
          </Btn>
          <Btn onClick={() => setUsers(new AsyncData<User[]>())}>reset</Btn>
        </ButtonRow>
      }
      output={
        <div>
          <AsyncWrapper renderLoading="no-data">
            <AsyncWrapperLoading>
              <Spinner />
            </AsyncWrapperLoading>
            <AsyncWrapperError>{error => <ErrorBanner message={error} />}</AsyncWrapperError>
            <AsyncWrapperData>
              {(users, isLoading) => (
                <div style={{ opacity: isLoading ? 0.5 : 1 }}>
                  {isLoading && (
                    <div>
                      <Spinner small /> <em style={{ fontSize: 12 }}>refetching…</em>
                    </div>
                  )}
                  <ul style={{ margin: 0 }}>
                    {users.map(u => (
                      <li key={u.id}>{u.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AsyncWrapperData>
          </AsyncWrapper>
          <div style={{ marginTop: 12 }}>
            {log.map((line, i) => (
              <div key={i} style={{ fontSize: 12, fontFamily: "monospace", color: "#666" }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      }
      panels={<StatePanel label="users" state={users} />}
      code={`
const fetchUsers = () => {
  users.abortController?.abort(); // cancel any in-flight request

  const controller = new AbortController();
  setUsers(prev => prev.withLoading(controller));

  fetch('/api/users', { signal: controller.signal })
    .then(res => res.json())
    .then(data => setUsers(prev => prev.withData(data)))
    .catch(err => {
      if (err.name !== 'AbortError') {
        setUsers(prev => prev.withError(err.message));
      }
    });
};`}
    />
  );
};

export const AbortInFlightRequests: Story = {
  render: () => <AbortDemo />,
};
