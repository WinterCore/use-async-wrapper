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
  title: "AsyncWrapper/Basics",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------

/** Shared button row driving a user-list AsyncData through every transition. */
const useUserControls = () => {
  const [users, setUsers] = React.useState(new AsyncData<User[]>());

  const controls = (
    <ButtonRow>
      <Btn onClick={() => setUsers(prev => prev.withLoading())}>withLoading()</Btn>
      <Btn onClick={() => setUsers(prev => prev.withData(mockUsers))}>withData(users)</Btn>
      <Btn onClick={() => setUsers(prev => prev.withError("Failed to load users"))}>
        withError(...)
      </Btn>
      <Btn onClick={() => setUsers(new AsyncData<User[]>())}>reset (Empty)</Btn>
    </ButtonRow>
  );

  return { users, controls };
};

const UserList = ({ users }: { users: User[] }) => (
  <ul style={{ margin: 0 }}>
    {users.map(u => (
      <li key={u.id}>{u.name}</li>
    ))}
  </ul>
);

// ---------------------------------------------------------------------------

const DefaultFallbacksDemo = () => {
  const { users, controls } = useUserControls();
  const { AsyncWrapper, AsyncWrapperData } = useAsyncWrapper(users);

  return (
    <Demo
      intro={
        <>
          Only an <code>AsyncWrapperData</code> child is provided, so the built-in fallbacks
          render for loading and error. The Empty state (after reset) renders nothing.
        </>
      }
      controls={controls}
      output={
        <AsyncWrapper>
          <AsyncWrapperData>{users => <UserList users={users} />}</AsyncWrapperData>
        </AsyncWrapper>
      }
      panels={<StatePanel label="users" state={users} />}
      code={`
const [users, setUsers] = useState(new AsyncData<User[]>());
const { AsyncWrapper, AsyncWrapperData } = useAsyncWrapper(users);

return (
  <AsyncWrapper>
    <AsyncWrapperData>
      {(users) => <UserList users={users} />}
    </AsyncWrapperData>
  </AsyncWrapper>
);

// While loading renders: <div>Loading...</div>
// On error renders:      <div>Error: {errorMessage}</div>
// Empty renders nothing`}
    />
  );
};

export const DefaultFallbacks: Story = {
  render: () => <DefaultFallbacksDemo />,
};

// ---------------------------------------------------------------------------

const CustomStatesDemo = () => {
  const { users, controls } = useUserControls();
  const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError, AsyncWrapperLoading } =
    useAsyncWrapper(users);

  return (
    <Demo
      intro={
        <>
          <code>AsyncWrapperLoading</code> and <code>AsyncWrapperError</code> children replace
          the built-in fallbacks. The error render function receives the typed error value.
        </>
      }
      controls={controls}
      output={
        <AsyncWrapper>
          <AsyncWrapperLoading>
            <Spinner />
          </AsyncWrapperLoading>
          <AsyncWrapperError>{error => <ErrorBanner message={error} />}</AsyncWrapperError>
          <AsyncWrapperData>{users => <UserList users={users} />}</AsyncWrapperData>
        </AsyncWrapper>
      }
      panels={<StatePanel label="users" state={users} />}
      code={`
<AsyncWrapper>
  <AsyncWrapperLoading>
    <Spinner />
  </AsyncWrapperLoading>
  <AsyncWrapperError>
    {(error) => <ErrorBanner message={error} />}
  </AsyncWrapperError>
  <AsyncWrapperData>
    {(users) => <UserList users={users} />}
  </AsyncWrapperData>
</AsyncWrapper>`}
    />
  );
};

export const CustomLoadingAndError: Story = {
  render: () => <CustomStatesDemo />,
};

// ---------------------------------------------------------------------------

const SuppressedDefaultsDemo = () => {
  const { users, controls } = useUserControls();
  const { AsyncWrapper, AsyncWrapperData } = useAsyncWrapper(users);

  return (
    <Demo
      intro={
        <>
          <code>dontRenderDefaultLoading</code> and <code>dontRenderDefaultError</code> suppress
          the built-in fallbacks — loading and error states render nothing, so you can handle
          them elsewhere (a global toast, a page-level indicator).
        </>
      }
      controls={controls}
      output={
        <AsyncWrapper dontRenderDefaultLoading dontRenderDefaultError>
          <AsyncWrapperData>{users => <UserList users={users} />}</AsyncWrapperData>
        </AsyncWrapper>
      }
      panels={<StatePanel label="users" state={users} />}
      code={`
<AsyncWrapper dontRenderDefaultLoading dontRenderDefaultError>
  <AsyncWrapperData>
    {(users) => <UserList users={users} />}
  </AsyncWrapperData>
</AsyncWrapper>

// Loading and error states render null — handle them outside the wrapper`}
    />
  );
};

export const SuppressedDefaults: Story = {
  render: () => <SuppressedDefaultsDemo />,
};

// ---------------------------------------------------------------------------

const StaticChildrenDemo = () => {
  const { users, controls } = useUserControls();
  const { AsyncWrapper, AsyncWrapperData, AsyncWrapperLoading } = useAsyncWrapper(users);

  return (
    <Demo
      intro={
        <>
          Children that aren't state components always render, regardless of state — so
          headings and other static content can live inside the wrapper. State components can
          also be nested deeper than the direct-children level (the heading wraps one here);
          just keep them direct children when you rely on default-fallback suppression.
        </>
      }
      controls={controls}
      output={
        <AsyncWrapper dontRenderDefaultLoading>
          <h4 style={{ margin: "0 0 8px" }}>Team members (always visible)</h4>
          <div>
            <AsyncWrapperLoading>
              <Spinner small /> <em style={{ fontSize: 13 }}>nested loading state…</em>
            </AsyncWrapperLoading>
          </div>
          <AsyncWrapperData>{users => <UserList users={users} />}</AsyncWrapperData>
        </AsyncWrapper>
      }
      panels={<StatePanel label="users" state={users} />}
      code={`
<AsyncWrapper dontRenderDefaultLoading>
  <h4>Team members (always visible)</h4>
  <div>
    {/* nested deeper than direct children — still works via context */}
    <AsyncWrapperLoading>
      <Spinner small /> <em>nested loading state…</em>
    </AsyncWrapperLoading>
  </div>
  <AsyncWrapperData>
    {(users) => <UserList users={users} />}
  </AsyncWrapperData>
</AsyncWrapper>`}
    />
  );
};

export const StaticAndNestedChildren: Story = {
  render: () => <StaticChildrenDemo />,
};

// ---------------------------------------------------------------------------

const UnwrapDemo = () => {
  const { users, controls } = useUserControls();
  const { AsyncWrapper, AsyncWrapperData } = useAsyncWrapper(users);
  const [log, setLog] = React.useState<string[]>([]);

  return (
    <Demo
      intro={
        <>
          <code>unwrap()</code> returns the data or throws — safe inside event handlers that
          can only fire from within <code>AsyncWrapperData</code>. <code>get()</code> is the
          non-throwing variant returning <code>T | undefined</code>.
        </>
      }
      controls={controls}
      output={
        <AsyncWrapper>
          <AsyncWrapperData>
            {list => (
              <div>
                <UserList users={list} />
                <Btn
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    // users.unwrap() is safe here: this button only exists when data is present
                    setLog(prev => [
                      `unwrap() → ${users.unwrap().length} users`,
                      ...prev.slice(0, 4),
                    ])
                  }
                >
                  Log via unwrap()
                </Btn>
                {log.map((line, i) => (
                  <div key={i} style={{ fontSize: 12, fontFamily: "monospace", color: "#666" }}>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </AsyncWrapperData>
        </AsyncWrapper>
      }
      panels={<StatePanel label="users" state={users} />}
      code={`
<AsyncWrapperData>
  {(list) => (
    <>
      <UserList users={list} />
      {/* Safe: this handler can only fire while data is present */}
      <button onClick={() => console.log(users.unwrap())}>
        Log via unwrap()
      </button>
    </>
  )}
</AsyncWrapperData>

// Elsewhere, when presence is not guaranteed:
const maybeUsers = users.get(); // User[] | undefined`}
    />
  );
};

export const UnwrapInEventHandlers: Story = {
  render: () => <UnwrapDemo />,
};
