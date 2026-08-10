export class AsyncData<T, E = string> {
  static readonly Empty: unique symbol = Symbol('empty');

  public data: T | typeof AsyncData.Empty;
  public isLoading: boolean;
  public error: E | null;
  public abortController: AbortController | null;

  /**
   * Creates a new AsyncData instance.
   *
   * All fields default to their "blank slate" values: no data, not loading, no error.
   *
   * @example
   * // Initial state — no data, not loading
   * const state = new AsyncData<User>();
   *
   * @example
   * // Pre-populated with data
   * const state = new AsyncData<User>({ data: { id: 1, name: 'Alice' } });
   *
   * @example
   * // Loading state with an abort controller
   * const controller = new AbortController();
   * const state = new AsyncData<User>({ isLoading: true, abortController: controller });
   */
  constructor(opts: {
    data?: T | typeof AsyncData.Empty,
    isLoading?: boolean,
    error?: E | null,
    abortController?: AbortController | null,
  } = {}) {
    const {
      data = AsyncData.Empty,
      error = null,
      isLoading = false,
      abortController = null,
    } = opts;

    this.data = data;
    this.isLoading = isLoading;
    this.error = error;
    this.abortController = abortController;
  }

  /**
   * Returns the data value, or `undefined` if no data has been loaded yet.
   *
   * @example
   * const user = state.get(); // User | undefined
   * if (user) {
   *   console.log(user.name);
   * }
   */
  public get(): T | undefined {
    return this.data === AsyncData.Empty ? undefined : this.data;
  }

  /**
   * Returns the data value, or throws if no data has been loaded yet.
   *
   * Use this when you can guarantee that data is present — for example, in an event
   * handler that can only be triggered from within `AsyncWrapperData`.
   *
   * @example
   * <AsyncWrapperData>
   *   {(user) => (
   *     <button onClick={() => console.log(usersData.unwrap())}>
   *       Log all users
   *     </button>
   *   )}
   * </AsyncWrapperData>
   *
   * @throws {Error} If data is empty.
   */
  public unwrap(): T {
    if (this.data === AsyncData.Empty) {
      throw new Error('Attempted to unwrap empty AsyncData');
    }
    return this.data;
  }

  /**
   * Returns a new `AsyncData` with `isLoading` set to `true`, preserving existing data.
   *
   * Preserving existing data enables stale-while-revalidate: the old data remains
   * accessible while a new fetch is in progress.
   *
   * @param abortController - Optional controller for the in-flight request. Store it
   * here so it can be cancelled before starting a new fetch.
   *
   * @example
   * const fetchUsers = () => {
   *   state.abortController?.abort(); // cancel any in-flight request
   *
   *   const controller = new AbortController();
   *   setState(prev => prev.withLoading(controller));
   *
   *   fetch('/api/users', { signal: controller.signal })
   *     .then(res => res.json())
   *     .then(data => setState(prev => prev.withData(data)))
   *     .catch(err => {
   *       if (err.name !== 'AbortError') {
   *         setState(prev => prev.withError(err.message));
   *       }
   *     });
   * };
   */
  public withLoading(abortController?: AbortController): AsyncData<T, E> {
    return new AsyncData<T, E>({
      data: this.data,
      isLoading: true,
      abortController,
    });
  }

  /**
   * Returns a new `AsyncData` with the given error set, clearing data and abortController.
   *
   * @example
   * setState(prev => prev.withError('Failed to load users'));
   */
  public withError(error: E): AsyncData<T, E> {
    return new AsyncData<T, E>({ error, abortController: null });
  }

  /**
   * Returns a new `AsyncData` with the given data set, clearing isLoading and abortController.
   *
   * @example
   * setState(prev => prev.withData(responseData));
   */
  public withData(data: T): AsyncData<T, E> {
    return new AsyncData<T, E>({ data, abortController: null });
  }

  /**
   * Merges any number of `AsyncData` instances into one that resolves when all are ready.
   * The combined data is a tuple typed from the arguments.
   *
   * - If any has an error, the combined result carries that error (first wins).
   * - If any is loading, the combined result is loading.
   * - If any has no data yet, the combined result has no data.
   * - Only when all have data is the combined result populated.
   *
   * @example
   * const combined = AsyncData.combine(user, posts);
   * // AsyncData<[User, Post[]]>
   *
   * const { AsyncWrapper, AsyncWrapperData } = useAsyncWrapper(combined);
   *
   * return (
   *   <AsyncWrapper>
   *     <AsyncWrapperData>
   *       {([user, posts]) => (
   *         <div>{user.name} has {posts.length} posts</div>
   *       )}
   *     </AsyncWrapperData>
   *   </AsyncWrapper>
   * );
   */
  static combine<Ts extends readonly unknown[], E = string>(
    ...items: { [K in keyof Ts]: AsyncData<Ts[K], E> }
  ): AsyncData<Ts, E> {
    for (const item of items) {
      if (item.error !== null) {
        return new AsyncData<Ts, E>({ error: item.error });
      }
    }

    const isLoading = items.some(item => item.isLoading);

    if (items.some(item => item.data === AsyncData.Empty)) {
      return new AsyncData<Ts, E>({ isLoading });
    }

    return new AsyncData<Ts, E>({ data: items.map(item => item.data) as unknown as Ts, isLoading });
  }

  /**
   * Transforms the data value if present. `isLoading`, `error`, and `abortController`
   * are always preserved, so a stale-while-revalidate state (data + loading) survives
   * the transform.
   *
   * If the data is empty (not yet loaded), the mapper is not called.
   *
   * @example
   * const users = new AsyncData<User[]>({ data: [{ id: 1, name: 'Alice' }] });
   * const ids = users.map(users => users.map(u => u.id));
   * // AsyncData<number[]> with data [1]
   *
   * @example
   * // Safe to call on empty/loading state — mapper is skipped
   * const empty = new AsyncData<User[]>();
   * const ids = empty.map(users => users.map(u => u.id));
   * // AsyncData<number[]>, still empty
   */
  public map<D>(mapper: (input: T) => D): AsyncData<D, E> {
    return new AsyncData<D, E>({
      abortController: this.abortController,
      data: this.data === AsyncData.Empty ? AsyncData.Empty : mapper(this.data),
      error: this.error,
      isLoading: this.isLoading,
    });
  }

  /**
   * Transforms the error value if present — the error-channel counterpart of `map`.
   * `data`, `isLoading`, and `abortController` always pass through unchanged.
   *
   * Useful for normalizing error types at a boundary so sources with different
   * error types can `combine` into one pipeline.
   *
   * If the error is `null`, the mapper is not called.
   *
   * @example
   * const users = new AsyncData<User[], ApiError>({ error: { code: 503, message: 'down' } });
   * const friendly = users.mapError(e => e.message);
   * // AsyncData<User[], string>
   */
  public mapError<F>(mapper: (error: E) => F): AsyncData<T, F> {
    return new AsyncData<T, F>({
      abortController: this.abortController,
      data: this.data,
      error: this.error === null ? null : mapper(this.error),
      isLoading: this.isLoading,
    });
  }

  /**
   * Like `map`, but the mapper returns an `AsyncData` which is flattened into the
   * result — the monadic bind. Use this when the transformation is itself
   * async-stateful, e.g. looking up another `AsyncData` based on the loaded value.
   *
   * - If this data is empty (not yet loaded), the mapper is not called and the
   *   empty/loading/error state passes through, as with `map`.
   * - If this data is present, the result merges both states: loading if either is
   *   loading, first error wins, data comes from the mapper's result.
   *
   * @example
   * // Dependent async values: pick a per-user AsyncData once the user is loaded
   * const posts = user.flatMap(u => postsByUserId[u.id] ?? new AsyncData<Post[]>());
   * // AsyncData<Post[]> — empty until user loads, then tracks the inner state
   */
  public flatMap<D>(mapper: (input: T) => AsyncData<D, E>): AsyncData<D, E> {
    if (this.data === AsyncData.Empty) {
      return new AsyncData<D, E>({
        abortController: this.abortController,
        error: this.error,
        isLoading: this.isLoading,
      });
    }

    const result = mapper(this.data);

    return new AsyncData<D, E>({
      data: result.data,
      isLoading: this.isLoading || result.isLoading,
      error: this.error ?? result.error,
      abortController: result.abortController ?? this.abortController,
    });
  }
}
