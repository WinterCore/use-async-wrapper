import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AsyncData, useAsyncWrapper } from "../src";
import {
  Btn,
  ButtonRow,
  Demo,
  ErrorBanner,
  mockPostsByUser,
  mockProducts,
  mockUsers,
  Spinner,
  StatePanel,
  type Post,
  type Product,
  type User,
} from "./helpers";

const meta = {
  title: "AsyncData/Composition",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------

const CombineDemo = () => {
  const [products, setProducts] = React.useState(new AsyncData<Product[]>());
  const [rate, setRate] = React.useState(new AsyncData<number>());

  const converted = React.useMemo(
    () =>
      AsyncData.combine(products, rate).map(([products, rate]) =>
        products.map(p => ({ ...p, price: Math.round(p.price * rate * 100) / 100 })),
      ),
    [products, rate],
  );

  const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError, AsyncWrapperLoading } =
    useAsyncWrapper(converted);

  return (
    <Demo
      intro={
        <>
          Two independent sources, one combined render. Drive each source separately and watch
          the combined state: it only has data when <em>both</em> do, is loading when{" "}
          <em>either</em> is, and carries the first error. <code>map</code> then converts
          prices — only when both are ready.
        </>
      }
      controls={
        <>
          <ButtonRow label="products">
            <Btn onClick={() => setProducts(prev => prev.withLoading())}>load</Btn>
            <Btn onClick={() => setProducts(prev => prev.withData(mockProducts))}>resolve</Btn>
            <Btn onClick={() => setProducts(prev => prev.withError("Products API down"))}>
              fail
            </Btn>
            <Btn onClick={() => setProducts(new AsyncData<Product[]>())}>reset</Btn>
          </ButtonRow>
          <ButtonRow label="rate">
            <Btn onClick={() => setRate(prev => prev.withLoading())}>load</Btn>
            <Btn onClick={() => setRate(prev => prev.withData(0.92))}>resolve (0.92)</Btn>
            <Btn onClick={() => setRate(prev => prev.withError("Rate API down"))}>fail</Btn>
            <Btn onClick={() => setRate(new AsyncData<number>())}>reset</Btn>
          </ButtonRow>
        </>
      }
      output={
        <AsyncWrapper>
          <AsyncWrapperLoading>
            <Spinner />
          </AsyncWrapperLoading>
          <AsyncWrapperError>{error => <ErrorBanner message={error} />}</AsyncWrapperError>
          <AsyncWrapperData>
            {products => (
              <ul style={{ margin: 0 }}>
                {products.map(p => (
                  <li key={p.id}>
                    {p.name} — €{p.price}
                  </li>
                ))}
              </ul>
            )}
          </AsyncWrapperData>
        </AsyncWrapper>
      }
      panels={
        <>
          <StatePanel label="products" state={products} />
          <StatePanel label="rate" state={rate} />
          <StatePanel label="combined" state={converted} />
        </>
      }
      code={`
const converted = useMemo(
  () => AsyncData.combine(products, rate)
    .map(([products, rate]) =>
      products.map(p => ({ ...p, price: p.price * rate }))),
  [products, rate],
);

const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError } =
  useAsyncWrapper(converted);

// combined rules:
// - any error    → that error (first wins)
// - any loading  → loading
// - any empty    → empty
// - all data     → data tuple, then map() converts prices`}
    />
  );
};

export const Combine: Story = {
  render: () => <CombineDemo />,
};

// ---------------------------------------------------------------------------

const CombineManyDemo = () => {
  const [user, setUser] = React.useState(new AsyncData<User>());
  const [posts, setPosts] = React.useState(new AsyncData<Post[]>());
  const [count, setCount] = React.useState(new AsyncData<number>());

  const combined = React.useMemo(
    () => AsyncData.combine(user, posts, count),
    [user, posts, count],
  );

  const { AsyncWrapper, AsyncWrapperData } = useAsyncWrapper(combined);

  const resolveAll = () => {
    setUser(prev => prev.withData(mockUsers[0]));
    setPosts(prev => prev.withData(mockPostsByUser[1]));
    setCount(prev => prev.withData(42));
  };

  return (
    <Demo
      intro={
        <>
          <code>combine</code> is variadic — pass any number of sources and get a typed tuple.
          The wrapper renders only when all three have data.
        </>
      }
      controls={
        <>
          <ButtonRow label="each">
            <Btn onClick={() => setUser(prev => prev.withData(mockUsers[0]))}>user ✓</Btn>
            <Btn onClick={() => setPosts(prev => prev.withData(mockPostsByUser[1]))}>
              posts ✓
            </Btn>
            <Btn onClick={() => setCount(prev => prev.withData(42))}>count ✓</Btn>
          </ButtonRow>
          <ButtonRow label="all">
            <Btn onClick={resolveAll}>resolve all</Btn>
            <Btn
              onClick={() => {
                setUser(new AsyncData<User>());
                setPosts(new AsyncData<Post[]>());
                setCount(new AsyncData<number>());
              }}
            >
              reset all
            </Btn>
          </ButtonRow>
        </>
      }
      output={
        <AsyncWrapper dontRenderDefaultLoading>
          <AsyncWrapperData>
            {([user, posts, count]) => (
              <span>
                {user.name} has {posts.length} posts and {count} followers
              </span>
            )}
          </AsyncWrapperData>
        </AsyncWrapper>
      }
      panels={
        <>
          <StatePanel label="user" state={user} />
          <StatePanel label="posts" state={posts} />
          <StatePanel label="count" state={count} />
          <StatePanel label="combined" state={combined} />
        </>
      }
      code={`
const combined = AsyncData.combine(user, posts, count);
// AsyncData<[User, Post[], number]>

<AsyncWrapperData>
  {([user, posts, count]) => (
    <span>{user.name} has {posts.length} posts and {count} followers</span>
  )}
</AsyncWrapperData>`}
    />
  );
};

export const CombineMany: Story = {
  render: () => <CombineManyDemo />,
};

// ---------------------------------------------------------------------------

const MapDemo = () => {
  const [users, setUsers] = React.useState(new AsyncData<User[]>());

  const names = React.useMemo(() => users.map(list => list.map(u => u.name)), [users]);

  const normalized = React.useMemo(
    () => users.mapError(e => (e === "ERR_USERS_DOWN" ? "Users service is down" : e)),
    [users],
  );

  return (
    <Demo
      intro={
        <>
          <code>map</code> transforms the data while <code>isLoading</code>, <code>error</code>,
          and <code>abortController</code> pass through unchanged — press <em>refetch</em> after
          resolving and the mapped value keeps both the stale data <em>and</em> the loading
          flag. <code>mapError</code> is the error-channel counterpart: press <em>fail</em> and
          watch the raw error code become a human-readable message.
        </>
      }
      controls={
        <ButtonRow>
          <Btn onClick={() => setUsers(prev => prev.withLoading())}>refetch — withLoading()</Btn>
          <Btn onClick={() => setUsers(prev => prev.withData(mockUsers))}>resolve</Btn>
          <Btn onClick={() => setUsers(prev => prev.withError("ERR_USERS_DOWN"))}>fail</Btn>
          <Btn onClick={() => setUsers(new AsyncData<User[]>())}>reset</Btn>
        </ButtonRow>
      }
      output={
        <div style={{ fontSize: 13.5 }}>
          mapped value: <code>{JSON.stringify(names.get() ?? null)}</code>
        </div>
      }
      panels={
        <>
          <StatePanel label="users" state={users} />
          <StatePanel label="mapped" state={names} />
          <StatePanel label="mapError'd" state={normalized} />
        </>
      }
      code={`
const names = users.map(list => list.map(u => u.name));
// AsyncData<string[]> — same isLoading/error state, data transformed

const normalized = users.mapError(e =>
  e === 'ERR_USERS_DOWN' ? 'Users service is down' : e);
// error transformed, data/loading untouched

// Stale-while-revalidate survives the transform:
// users:  { data: [...], isLoading: true }
// names:  { data: [...names], isLoading: true }   ← loading flag preserved`}
    />
  );
};

export const MapTransform: Story = {
  render: () => <MapDemo />,
};

// ---------------------------------------------------------------------------

const FlatMapDemo = () => {
  const [user, setUser] = React.useState(new AsyncData<User>());
  const [postsStore, setPostsStore] = React.useState<Record<number, AsyncData<Post[]>>>({});

  const posts = React.useMemo(
    () => user.flatMap(u => postsStore[u.id] ?? new AsyncData<Post[]>()),
    [user, postsStore],
  );

  const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError, AsyncWrapperLoading } =
    useAsyncWrapper(posts);

  const setStore = (id: number, value: AsyncData<Post[]>) =>
    setPostsStore(prev => ({ ...prev, [id]: value }));

  const userId = user.get()?.id;

  return (
    <Demo
      intro={
        <>
          <code>flatMap</code> is for dependent async values: the mapper returns another{" "}
          <code>AsyncData</code>, which is flattened into the result. Here, posts can only be
          looked up once the user is loaded — until then the result is empty and the mapper
          never runs.
        </>
      }
      controls={
        <>
          <ButtonRow label="user">
            <Btn onClick={() => setUser(prev => prev.withLoading())}>load</Btn>
            <Btn onClick={() => setUser(prev => prev.withData(mockUsers[0]))}>
              resolve (Alice)
            </Btn>
            <Btn onClick={() => setUser(new AsyncData<User>())}>reset</Btn>
          </ButtonRow>
          <ButtonRow label="posts">
            <Btn
              disabled={userId === undefined}
              onClick={() =>
                userId !== undefined &&
                setStore(userId, (postsStore[userId] ?? new AsyncData<Post[]>()).withLoading())
              }
            >
              load
            </Btn>
            <Btn
              disabled={userId === undefined}
              onClick={() =>
                userId !== undefined &&
                setStore(userId, new AsyncData<Post[]>().withData(mockPostsByUser[userId] ?? []))
              }
            >
              resolve
            </Btn>
            <Btn
              disabled={userId === undefined}
              onClick={() =>
                userId !== undefined &&
                setStore(userId, new AsyncData<Post[]>().withError("Posts API down"))
              }
            >
              fail
            </Btn>
          </ButtonRow>
        </>
      }
      output={
        <AsyncWrapper dontRenderDefaultLoading>
          <AsyncWrapperLoading>
            <Spinner />
          </AsyncWrapperLoading>
          <AsyncWrapperError>{error => <ErrorBanner message={error} />}</AsyncWrapperError>
          <AsyncWrapperData>
            {posts => (
              <ul style={{ margin: 0 }}>
                {posts.length === 0 ? (
                  <em>no posts</em>
                ) : (
                  posts.map(p => <li key={p.id}>{p.title}</li>)
                )}
              </ul>
            )}
          </AsyncWrapperData>
        </AsyncWrapper>
      }
      panels={
        <>
          <StatePanel label="user" state={user} />
          <StatePanel label="flatMapped" state={posts} />
        </>
      }
      code={`
const posts = user.flatMap(u => postsByUserId[u.id] ?? new AsyncData<Post[]>());
// AsyncData<Post[]>

// - user empty/loading/error → passes through, mapper not called
// - user loaded → result merges both states:
//   loading if either is loading, first error wins, data from the inner value`}
    />
  );
};

export const FlatMapDependent: Story = {
  render: () => <FlatMapDemo />,
};
