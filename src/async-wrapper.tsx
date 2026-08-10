import React from "react";
import { AsyncData } from "./async-data";

/**
 * The state `AsyncWrapper` resolved from its `AsyncData`, delivered to the state
 * components via context. Exactly one kind is active at a time.
 */
type ResolvedState<T, E> =
  | { readonly kind: 'error'; readonly error: E }
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'data'; readonly data: T; readonly isLoading: boolean };

const AsyncWrapperContext = React.createContext<ResolvedState<unknown, unknown> | null>(null);

const useResolvedState = (componentName: string): ResolvedState<unknown, unknown> => {
  const state = React.useContext(AsyncWrapperContext);
  if (state === null) {
    throw new Error(`${componentName} must be used within an AsyncWrapper`);
  }
  return state;
};

const hasDirectChildOfType = (children: React.ReactNode, type: React.ElementType): boolean =>
  React.Children.toArray(children).some(
    child => React.isValidElement(child) && child.type === type
  );

interface AsyncWrapperErrorProps<E> {
  readonly children?: (error: E) => React.ReactNode;
}

/**
 * Renders when `AsyncWrapper` is in an error state.
 *
 * The error value is passed to the child render function, typed as `E`.
 * If no `AsyncWrapperError` is provided at all, `AsyncWrapper` renders a default
 * `<div>Error: ...</div>` fallback unless `dontRenderDefaultError` is set.
 *
 * Reads its state from `AsyncWrapper` context, so it can be nested anywhere inside.
 * Keep it a direct child of `AsyncWrapper` (or set `dontRenderDefaultError`) so the
 * wrapper can detect it and suppress the default fallback.
 *
 * @example
 * <AsyncWrapperError>
 *   {(error) => <ErrorBanner message={error} />}
 * </AsyncWrapperError>
 */
const AsyncWrapperError = <E,>(props: AsyncWrapperErrorProps<E>) => {
  const state = useResolvedState('AsyncWrapperError');

  if (state.kind !== 'error') {
    return null;
  }

  return props.children ? props.children(state.error as E) : null;
};

interface AsyncWrapperLoadingProps {
  readonly children?: React.ReactNode;
}

/**
 * Renders when `AsyncWrapper` is in a loading state.
 *
 * If no `AsyncWrapperLoading` is provided at all, `AsyncWrapper` renders a default
 * `<div>Loading...</div>` fallback unless `dontRenderDefaultLoading` is set.
 *
 * Reads its state from `AsyncWrapper` context, so it can be nested anywhere inside.
 * Keep it a direct child of `AsyncWrapper` (or set `dontRenderDefaultLoading`) so the
 * wrapper can detect it and suppress the default fallback.
 *
 * @example
 * <AsyncWrapperLoading>
 *   <Spinner />
 * </AsyncWrapperLoading>
 */
const AsyncWrapperLoading = (props: AsyncWrapperLoadingProps) => {
  const state = useResolvedState('AsyncWrapperLoading');

  if (state.kind !== 'loading') {
    return null;
  }

  return props.children ?? null;
}

interface AsyncWrapperProps<T, E> {
  /**
   * Controls when the loading state is shown relative to existing data.
   *
   * - `'always'`: Shows loading state whenever `isLoading` is true, even if data is
   *   already present. Stale data is hidden during refetches.
   * - `'no-data'`: Only shows loading state when `isLoading` is true and no data has
   *   been loaded yet. Once data exists, refetches render the data child with
   *   `isLoading: true`, enabling stale-while-revalidate UIs.
   *
   * @default 'always'
   */
  readonly renderLoading?: 'always' | 'no-data';

  /**
   * If true, renders `null` instead of the default `<div>Loading...</div>` fallback
   * when no `AsyncWrapperLoading` child is provided.
   */
  readonly dontRenderDefaultLoading?: boolean;

  /**
   * If true, renders `null` instead of the default `<div>Error: ...</div>` fallback
   * when no `AsyncWrapperError` child is provided.
   */
  readonly dontRenderDefaultError?: boolean;

  readonly children?: React.ReactNode;
  readonly data: AsyncData<T, E>;
}

interface AsyncWrapperDataProps<T> {
  readonly children?: (data: T, isLoading: boolean) => React.ReactNode;
}

/**
 * Renders when `AsyncWrapper` has data. Receives the data value and current `isLoading`
 * state as arguments.
 *
 * The `isLoading` argument is useful with `renderLoading="no-data"` to reflect a
 * background refetch in the UI (e.g. dimming, disabling a refresh button) while
 * continuing to show stale data.
 *
 * Reads its state from `AsyncWrapper` context, so it can be nested anywhere inside.
 *
 * @example
 * <AsyncWrapperData>
 *   {(users) => <UserList users={users} />}
 * </AsyncWrapperData>
 *
 * @example
 * // With isLoading for stale-while-revalidate
 * <AsyncWrapperData>
 *   {(users, isLoading) => <UserList users={users} dimmed={isLoading} />}
 * </AsyncWrapperData>
 */
const AsyncWrapperData = <T,>(props: AsyncWrapperDataProps<T>) => {
  const state = useResolvedState('AsyncWrapperData');

  if (state.kind !== 'data') {
    return null;
  }

  return props.children ? props.children(state.data as T, state.isLoading) : null;
};

/**
 * Resolves one of four states from the `AsyncData` instance — error, loading, empty,
 * or data, evaluated in that priority order — and provides it to its children via
 * context.
 *
 * `AsyncWrapperError`, `AsyncWrapperLoading`, and `AsyncWrapperData` each render only
 * when their state is active. Children that are not state components always render.
 * If no state component is provided for the error or loading state, a default fallback
 * is rendered unless the corresponding `dontRenderDefault*` prop is set.
 *
 * @example
 * // All defaults
 * <AsyncWrapper>
 *   <AsyncWrapperData>
 *     {(users) => <UserList users={users} />}
 *   </AsyncWrapperData>
 * </AsyncWrapper>
 *
 * @example
 * // Custom loading and error
 * <AsyncWrapper>
 *   <AsyncWrapperLoading><Spinner /></AsyncWrapperLoading>
 *   <AsyncWrapperError>{(error) => <ErrorBanner message={error} />}</AsyncWrapperError>
 *   <AsyncWrapperData>{(users) => <UserList users={users} />}</AsyncWrapperData>
 * </AsyncWrapper>
 *
 * @example
 * // Stale-while-revalidate — show old data during refetch
 * <AsyncWrapper renderLoading="no-data">
 *   <AsyncWrapperLoading><Spinner /></AsyncWrapperLoading>
 *   <AsyncWrapperData>
 *     {(users, isLoading) => <UserList users={users} dimmed={isLoading} />}
 *   </AsyncWrapperData>
 * </AsyncWrapper>
 */
const AsyncWrapper = <T, E>(props: AsyncWrapperProps<T, E>) => {
  const {
    dontRenderDefaultError,
    dontRenderDefaultLoading,
    renderLoading = 'always',
    data,
    children,
  } = props;

  let resolved: ResolvedState<T, E>;
  if (data.error !== null) {
    resolved = { kind: 'error', error: data.error };
  } else if (data.isLoading && (renderLoading === 'always' || data.data === AsyncData.Empty)) {
    resolved = { kind: 'loading' };
  } else if (data.data === AsyncData.Empty) {
    resolved = { kind: 'empty' };
  } else {
    resolved = { kind: 'data', data: data.data, isLoading: data.isLoading };
  }

  return (
    <AsyncWrapperContext.Provider value={resolved as ResolvedState<unknown, unknown>}>
      {children}
      {resolved.kind === 'error' && !dontRenderDefaultError && !hasDirectChildOfType(children, AsyncWrapperError) && (
        <div>Error: {String(resolved.error)}</div>
      )}
      {resolved.kind === 'loading' && !dontRenderDefaultLoading && !hasDirectChildOfType(children, AsyncWrapperLoading) && (
        <div>Loading...</div>
      )}
    </AsyncWrapperContext.Provider>
  );
};

/**
 * Returns typed React components bound to an `AsyncData` instance.
 *
 * `AsyncWrapperData` is typed to `T` and `AsyncWrapperError` is typed to `E`,
 * both inferred from the `asyncData` argument — no need to specify type parameters manually.
 *
 * The returned `AsyncWrapper` has `data` pre-bound, so it does not need a `data` prop.
 *
 * @example
 * const [users, setUsers] = useState(new AsyncData<User[]>());
 *
 * const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError, AsyncWrapperLoading } =
 *   useAsyncWrapper(users);
 *
 * return (
 *   <AsyncWrapper>
 *     <AsyncWrapperLoading><Spinner /></AsyncWrapperLoading>
 *     <AsyncWrapperError>{(error) => <ErrorBanner message={error} />}</AsyncWrapperError>
 *     <AsyncWrapperData>{(users) => <UserList users={users} />}</AsyncWrapperData>
 *   </AsyncWrapper>
 * );
 */
export const useAsyncWrapper = <T, E = string>(asyncData: AsyncData<T, E>) => {
  // Written during render so the bound wrapper — which renders later in the same
  // pass — always sees the latest value without changing component identity
  // (a dependency-driven useCallback would remount the subtree on every state change).
  const asyncDataRef = React.useRef(asyncData);
  asyncDataRef.current = asyncData;

  const BoundAsyncWrapper = React.useCallback(
    (props: Omit<AsyncWrapperProps<T, E>, 'data'>) =>
      <AsyncWrapper {...props} data={asyncDataRef.current} />,
    []
  );

  return {
    AsyncWrapper: BoundAsyncWrapper,
    AsyncWrapperData: AsyncWrapperData<T>,
    AsyncWrapperError: AsyncWrapperError<E>,
    AsyncWrapperLoading: AsyncWrapperLoading,
  };
};
