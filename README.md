# use-async-wrapper

You fetch some data. So you add an `isLoading` boolean, an `error` state, and a null check before rendering. Then the component needs a second fetch, and now you're juggling six state variables and a wall of `if`s just to decide what to show — and TypeScript still makes you `!` the data at the end. You've written this component a hundred times.

`use-async-wrapper` puts the whole thing in one typed value: `map` it, `combine` two of them, hand it to components that render the right thing for every state — loading, error, data, or refetching with stale data still on screen — without writing a single `if` condition.

**[▶ Live playground](https://use-async-wrapper.netlify.app)** — every feature as an interactive Storybook demo: drive the state machine with buttons and watch the UI react.

- **`AsyncData<T, E>`** — an immutable value describing an async operation: empty, loading, error, or data — with stale-while-revalidate built in
- **`useAsyncWrapper`** — typed components that render the right state, colocated with the data that drives them
- **`combine` / `map` / `flatMap`** — merge and transform async values without null guards or non-null assertions
- Zero dependencies. Works with plain `fetch`, websockets, one-off promises — any async source. Typed errors end to end.
- Optional React Query bridge — React Query fetches and caches; this renders

## Contents

- [Install](#install)
- [The problem](#the-problem)
- [AsyncData](#asyncdata)
  - [Initial state](#initial-state)
  - [withLoading](#withloading)
  - [withData / withError](#withdata--witherror)
  - [Cancelling in-flight requests](#cancelling-in-flight-requests)
  - [get / unwrap](#get--unwrap)
  - [map](#map)
  - [flatMap](#flatmap)
  - [combine](#combine)
- [useAsyncWrapper](#useasyncwrapper)
  - [Basic usage](#basic-usage)
  - [Default loading and error states](#default-loading-and-error-states)
  - [Custom loading and error states](#custom-loading-and-error-states)
  - [Suppressing default fallbacks](#suppressing-default-fallbacks)
  - [renderLoading](#renderloading)
  - [State priority](#state-priority)
- [Why not Suspense?](#why-not-suspense)
- [React Query](#react-query)
- [License](#license)

## Install

```bash
npm install use-async-wrapper
```

Requires React 18+. The optional [React Query bridge](#react-query) requires `@tanstack/react-query` v5.

## The problem

Async state in React is deceptively messy. Take something as common as fetching a product list and an exchange rate, then converting prices before rendering:

```tsx
const ProductList = ({ currency }: { currency: string }) => {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState<string | null>(null);

  // Products load once...
  useEffect(() => {
    setProductsLoading(true);
    fetchProducts()
      .then(data => { setProducts(data); setProductsLoading(false); })
      .catch(err => { setProductsError(err.message); setProductsLoading(false); });
  }, []);

  // ...but the rate refetches every time currency changes
  useEffect(() => {
    setExchangeRateLoading(true);
    fetchExchangeRate(currency)
      .then(rate => { setExchangeRate(rate); setExchangeRateLoading(false); })
      .catch(err => { setExchangeRateError(err.message); setExchangeRateLoading(false); });
  }, [currency]);

  // Have to guard against null even though the ifs below already do that
  const convertedProducts = useMemo(() => {
    if (!products || !exchangeRate) return null;
    return products.map(p => ({ ...p, price: p.price * exchangeRate }));
  }, [products, exchangeRate]);

  if (productsLoading || exchangeRateLoading) return <div>Loading...</div>;
  if (productsError) return <div>Error loading products: {productsError}</div>;
  if (exchangeRateError) return <div>Error loading exchange rate: {exchangeRateError}</div>;
  // TypeScript still has no idea these are set despite all the checks above
  if (!convertedProducts) return null;

  return (
    <ul>
      {convertedProducts!.map(p => <li key={p.id}>{p.name} — {p.price}</li>)}
    </ul>
  );
};
```

Six state variables, two `useEffect`s (which can't be merged into one `Promise.all` — the fetches have different lifetimes), a `useMemo` that has to re-guard what the `if`s below already check, a non-null assertion at the end because TypeScript still isn't convinced, and four early returns — for something as routine as fetching two things and combining them.

Here's the same component with `use-async-wrapper`:

```tsx
import { AsyncData, useAsyncWrapper } from 'use-async-wrapper';

const ProductList = ({ currency }: { currency: string }) => {
  const [products, setProducts] = useState(new AsyncData<Product[]>());
  const [exchangeRate, setExchangeRate] = useState(new AsyncData<number>());

  useEffect(() => {
    setProducts(prev => prev.withLoading());
    fetchProducts()
      .then(data => setProducts(prev => prev.withData(data)))
      .catch(err => setProducts(prev => prev.withError(err.message)));
  }, []);

  useEffect(() => {
    setExchangeRate(prev => prev.withLoading());
    fetchExchangeRate(currency)
      .then(rate => setExchangeRate(prev => prev.withData(rate)))
      .catch(err => setExchangeRate(prev => prev.withError(err.message)));
  }, [currency]);

  const convertedProducts = useMemo(
    () => AsyncData.combine(products, exchangeRate)
      .map(([products, rate]) => products.map(p => ({ ...p, price: p.price * rate }))),
    [products, exchangeRate],
  );

  const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError } = useAsyncWrapper(convertedProducts);

  return (
    <AsyncWrapper renderLoading="no-data">
      <AsyncWrapperError>{(error) => <div>Error: {error}</div>}</AsyncWrapperError>
      <AsyncWrapperData>
        {(products, isLoading) => (
          <>
            {isLoading && <SmallSpinner />}
            <ul>
              {products.map(p => <li key={p.id}>{p.name} — {p.price}</li>)}
            </ul>
          </>
        )}
      </AsyncWrapperData>
    </AsyncWrapper>
  );
};
```

`combine` merges the two states — if either is loading or errored, the combined state reflects that. `map` transforms the data only when both are ready. No null guards, no non-null assertions, no redundant checks — and the error render function receives a typed error.

`renderLoading="no-data"` means the full loading state only shows before the first load. When `currency` changes, the product list stays visible with the stale prices and `isLoading` flips on for the small spinner — stale-while-revalidate without any extra bookkeeping. (Doing the same in the version above means yet another round of booleans.)

> If you're familiar with functional programming: `AsyncData` is essentially an `Either` with an extra loading dimension. `map`, `flatMap`, and `combine` are the functor/monad/applicative operations you'd recognise from Haskell, Rust's `Option`/`Result`, or fp-ts. If those words mean nothing to you, don't worry — you don't need any of that to use this.

---

## AsyncData

`AsyncData<T, E = string>` holds four pieces of state:

| Field | Type | Description |
|---|---|---|
| `data` | `T \| AsyncData.Empty` | The loaded value, or `Empty` if not yet loaded |
| `isLoading` | `boolean` | Whether a fetch is in progress |
| `error` | `E \| null` | The error, if one occurred |
| `abortController` | `AbortController \| null` | The controller for the in-flight request |

Instances are immutable — every transition returns a new `AsyncData`, which is what makes them safe to hold in React state.

### Initial state

```ts
// Empty, not loading, no error — a blank slate
const state = new AsyncData<User>();
```

### withLoading

Marks the state as loading. Preserves existing data, so stale-while-revalidate works naturally.

```ts
setUsers(prev => prev.withLoading(controller)); // controller is optional
```

### withData / withError

```ts
// On success
setUsers(prev => prev.withData(data));

// On failure
setUsers(prev => prev.withError('Failed to load users'));
```

`withData` and `withError` both clear `abortController`. `withLoading` preserves existing data so you can show stale data while refetching.

### Cancelling in-flight requests

The `abortController` field lets you cancel a previous request before starting a new one:

```ts
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
};
```

### get / unwrap

`get()` returns the data or `undefined` if empty. `unwrap()` returns the data or throws.

```ts
const value = state.get();     // User | undefined
const value = state.unwrap();  // User (throws if empty)
```

Use `get()` when you want to safely check, `unwrap()` when you can guarantee data is present — for example, in an event handler that can only be triggered from within `AsyncWrapperData`.

### map

Transforms the data value if present. The `isLoading`, `error`, and `abortController` state always passes through unchanged — so a stale-while-revalidate state (data present + refetch in flight) keeps its loading flag after the transform.

```ts
const ids = users.map(users => users.map(u => u.id));
// AsyncData<number[]> — same loading/error state, data transformed
```

If the data is empty (not yet loaded), the mapper is not called.

### flatMap

Like `map`, but the mapper returns an `AsyncData` which is flattened into the result (the monadic bind — `chain` in fp-ts, `and_then` in Rust). Use it when the transformation is itself async-stateful.

```ts
// Dependent async values: pick a per-user AsyncData once the user is loaded
const posts = user.flatMap(u => postsByUserId[u.id] ?? new AsyncData<Post[]>());
// AsyncData<Post[]> — empty until user loads, then tracks the inner state
```

Rules:
- If the outer data is empty, the mapper is not called and the empty/loading/error state passes through, as with `map`
- If the outer data is present, the result merges both states: loading if either is loading, first error wins, data comes from the mapper's result

### combine

Merges any number of independent `AsyncData` instances into one that resolves when all are ready. The combined data is a tuple typed from the arguments.

```ts
const combined = AsyncData.combine(user, posts);
// AsyncData<[User, Post[]]>

const bigger = AsyncData.combine(user, posts, comments, settings);
// AsyncData<[User, Post[], Comment[], Settings]>
```

Rules:
- If any has an error, the combined result has that error (first error wins)
- If any is loading, the combined result is loading
- If any has no data yet, the combined result has no data
- Only when all have data is the combined result populated

---

## useAsyncWrapper

Returns typed React components bound to an `AsyncData` instance.

```ts
const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError, AsyncWrapperLoading } =
  useAsyncWrapper(asyncData);
```

`AsyncWrapperData` is typed to `T` and `AsyncWrapperError` is typed to `E`, both inferred from the `asyncData` you pass in — no manual type parameters.

### Basic usage

```tsx
<AsyncWrapper>
  <AsyncWrapperData>
    {(users) => (
      <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
    )}
  </AsyncWrapperData>
</AsyncWrapper>
```

### Default loading and error states

If you don't provide `AsyncWrapperLoading` or `AsyncWrapperError` children, `AsyncWrapper` renders built-in fallbacks automatically:

```tsx
// While loading renders: <div>Loading...</div>
// On error renders:      <div>Error: {errorMessage}</div>
```

### Custom loading and error states

```tsx
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
</AsyncWrapper>
```

The error render function receives the error typed as `E`.

### Suppressing default fallbacks

If you want to handle loading or error states yourself outside of `AsyncWrapper`:

```tsx
<AsyncWrapper dontRenderDefaultLoading dontRenderDefaultError>
  <AsyncWrapperData>
    {(users) => <UserList users={users} />}
  </AsyncWrapperData>
</AsyncWrapper>
```

### renderLoading

Controls when the loading state is shown. Default is `'always'`.

**`'always'`** — shows the loading state whenever `isLoading` is true, even if data is already present. Stale data is replaced with the loading UI during refetches.

**`'no-data'`** — only shows the loading state when there is no data yet. Once data has loaded, refetches render the data child with `isLoading: true` — stale-while-revalidate:

```tsx
<AsyncWrapper renderLoading="no-data">
  <AsyncWrapperLoading>
    <Spinner />
  </AsyncWrapperLoading>
  <AsyncWrapperData>
    {(users, isLoading) => (
      <UserList users={users} dimmed={isLoading} />
    )}
  </AsyncWrapperData>
</AsyncWrapper>

// data=Empty, isLoading=true  → <Spinner />
// data=[...], isLoading=true  → <UserList dimmed />  (stale data stays visible)
// data=[...], isLoading=false → <UserList />
```

The second argument to the `AsyncWrapperData` render function is `isLoading`, so you can reflect a background refetch in the UI (dimming, disabling a refresh button).

### State priority

`AsyncWrapper` resolves one of four states, in this order:

1. **Error** — if `error !== null`, renders the error state (custom or default)
2. **Loading** — if `isLoading` and the `renderLoading` condition is met
3. **Empty** — if data is still `Empty`, renders nothing
4. **Data** — renders `AsyncWrapperData`

An error always takes priority over loading, and loading takes priority over stale data when `renderLoading="always"`.

The state components read the resolved state from context, so they can be nested anywhere inside `AsyncWrapper` — with one caveat: default-fallback detection only sees direct children, so to *replace* a default, keep the state component a direct child (or set the corresponding `dontRenderDefault*`). Children that aren't state components always render, so static content can live inside the wrapper alongside the state components.

---

## Why not Suspense?

Suspense is a solid model, and if it's working for you, keep it. The tradeoffs that motivated this library instead:

- **Errors are untyped** — an `ErrorBoundary` catches `Error`, not the typed error your fetch actually produced. `AsyncWrapperError` receives `E`.
- **Loading and error UI live away from the data** — boundaries sit up the tree; per-section error UI means a boundary per section, which forces component splits along boundary lines rather than logical ones. Here, fallbacks are colocated with the data that drives them.
- **Keeping stale UI during refetches requires orchestration** — transitions (`useTransition`, `useDeferredValue`) or library support. Here it's a prop: `renderLoading="no-data"`.
- **Suspense wants a cache layer** — suspending on plain promises requires stable promise identity across renders, which in practice means a framework or query library underneath. `AsyncData` is just a value; it works with a bare `fetch`.
- **React still ships no `ErrorBoundary` component** — you write the class component yourself or add a dependency.

---

## React Query

If you use React Query, this library isn't a competitor — it's designed to sit on top. React Query owns fetching: caching, deduplication, retries, invalidation. What it leaves to you is the render layer: per-component state checks, cross-query composition, and app-consistent fallbacks. v5's discriminated unions narrow a *single* query, but narrowing doesn't compose — a component depending on two queries is back to cross-checking states by hand.

The bridge converts query results into `AsyncData`, so `combine`, `map`, and `AsyncWrapper` work on top:

```tsx
import { AsyncData, useAsyncWrapper } from 'use-async-wrapper';
import { useQueryAsyncData } from 'use-async-wrapper/react-query';

const ProductList = ({ currency }: { currency: string }) => {
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const rateQuery = useQuery({ queryKey: ['rate', currency], queryFn: () => fetchExchangeRate(currency) });

  const products = useQueryAsyncData(productsQuery, { mapError: e => e.message });
  const rate = useQueryAsyncData(rateQuery, { mapError: e => e.message });

  const converted = useMemo(
    () => AsyncData.combine(products, rate)
      .map(([products, rate]) => products.map(p => ({ ...p, price: p.price * rate }))),
    [products, rate],
  );

  const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError } = useAsyncWrapper(converted);

  return (
    <AsyncWrapper renderLoading="no-data">
      <AsyncWrapperError>{(error) => <ErrorBanner message={error} />}</AsyncWrapperError>
      <AsyncWrapperData>
        {(products, isLoading) => (
          <ul data-dim={isLoading}>
            {products.map(p => <li key={p.id}>{p.name} — {p.price}</li>)}
          </ul>
        )}
      </AsyncWrapperData>
    </AsyncWrapper>
  );
};
```

Because `isFetching` maps to `isLoading` and cached data is preserved, React Query's background refetches flow straight into `renderLoading="no-data"` — stale prices stay visible, dimmed, while the new rate loads.

Notes:

- `mapError` converts the query's error (default `Error`) into your `AsyncData`'s error type. Without it, the error passes through as-is. It's read through a ref, so inline arrow functions don't churn the memo.
- Errors win over cached data, mirroring `AsyncWrapper`'s state priority.
- `undefined` data is treated as "not loaded" — don't use the bridge for queries where `undefined` is a valid payload.
- `queryToAsyncData` is the pure, non-hook version of the same conversion, useful in tests or outside components.

## License

MIT
