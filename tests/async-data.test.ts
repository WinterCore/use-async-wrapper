import { describe, expect, it, vi } from "vitest";
import { AsyncData } from "../src/async-data";

describe("constructor", () => {
  it("defaults to a blank slate", () => {
    const state = new AsyncData<number>();
    expect(state.get()).toBeUndefined();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.abortController).toBeNull();
  });

  it("accepts initial values", () => {
    const controller = new AbortController();
    const state = new AsyncData<number, string>({
      data: 5,
      isLoading: true,
      error: "boom",
      abortController: controller,
    });
    expect(state.get()).toBe(5);
    expect(state.isLoading).toBe(true);
    expect(state.error).toBe("boom");
    expect(state.abortController).toBe(controller);
  });
});

describe("get / unwrap", () => {
  it("get returns undefined when empty", () => {
    expect(new AsyncData<number>().get()).toBeUndefined();
  });

  it("get returns falsy data values correctly", () => {
    expect(new AsyncData<number>({ data: 0 }).get()).toBe(0);
    expect(new AsyncData<string>({ data: "" }).get()).toBe("");
    expect(new AsyncData<boolean>({ data: false }).get()).toBe(false);
  });

  it("unwrap returns the data", () => {
    expect(new AsyncData<number>({ data: 7 }).unwrap()).toBe(7);
  });

  it("unwrap throws when empty", () => {
    expect(() => new AsyncData<number>().unwrap()).toThrow(
      "Attempted to unwrap empty AsyncData",
    );
  });
});

describe("withLoading", () => {
  it("sets isLoading and preserves existing data (stale-while-revalidate)", () => {
    const state = new AsyncData<number>({ data: 1 }).withLoading();
    expect(state.isLoading).toBe(true);
    expect(state.get()).toBe(1);
  });

  it("stores the abort controller", () => {
    const controller = new AbortController();
    const state = new AsyncData<number>().withLoading(controller);
    expect(state.abortController).toBe(controller);
  });

  it("clears a previous error (retry after failure)", () => {
    const state = new AsyncData<number, string>({ error: "boom" }).withLoading();
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it("returns a new instance", () => {
    const before = new AsyncData<number>();
    expect(before.withLoading()).not.toBe(before);
    expect(before.isLoading).toBe(false);
  });
});

describe("withData", () => {
  it("sets data and clears loading/error/abortController", () => {
    const state = new AsyncData<number, string>({
      isLoading: true,
      abortController: new AbortController(),
    }).withData(9);
    expect(state.get()).toBe(9);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.abortController).toBeNull();
  });
});

describe("withError", () => {
  it("sets the error and clears data/loading/abortController", () => {
    const state = new AsyncData<number, string>({
      data: 1,
      isLoading: true,
      abortController: new AbortController(),
    }).withError("boom");
    expect(state.error).toBe("boom");
    expect(state.get()).toBeUndefined();
    expect(state.isLoading).toBe(false);
    expect(state.abortController).toBeNull();
  });
});

describe("map", () => {
  it("transforms the data", () => {
    const state = new AsyncData<number[]>({ data: [1, 2, 3] }).map(xs => xs.length);
    expect(state.get()).toBe(3);
  });

  it("preserves isLoading, error, and abortController through the transform", () => {
    const controller = new AbortController();
    const state = new AsyncData<number>({
      data: 2,
      isLoading: true,
      abortController: controller,
    }).map(n => n * 10);
    expect(state.get()).toBe(20);
    expect(state.isLoading).toBe(true);
    expect(state.abortController).toBe(controller);
  });

  it("skips the mapper when empty and passes state through", () => {
    const mapper = vi.fn((n: number) => n * 2);
    const state = new AsyncData<number, string>({ isLoading: true }).map(mapper);
    expect(mapper).not.toHaveBeenCalled();
    expect(state.get()).toBeUndefined();
    expect(state.isLoading).toBe(true);
  });

  it("passes an error state through untouched", () => {
    const mapper = vi.fn((n: number) => n * 2);
    const state = new AsyncData<number, string>({ error: "boom" }).map(mapper);
    expect(mapper).not.toHaveBeenCalled();
    expect(state.error).toBe("boom");
  });

  it("maps falsy data values", () => {
    const state = new AsyncData<number>({ data: 0 }).map(n => n + 1);
    expect(state.get()).toBe(1);
  });
});

describe("mapError", () => {
  it("transforms the error", () => {
    const state = new AsyncData<number, string>({ error: "ERR_DOWN" }).mapError(e =>
      e.toLowerCase(),
    );
    expect(state.error).toBe("err_down");
  });

  it("changes the error type", () => {
    const state = new AsyncData<number, { code: number }>({ error: { code: 503 } }).mapError(
      e => `HTTP ${e.code}`,
    );
    expect(state.error).toBe("HTTP 503");
  });

  it("skips the mapper when error is null and preserves data/loading/abortController", () => {
    const mapper = vi.fn((e: string) => e);
    const controller = new AbortController();
    const state = new AsyncData<number, string>({
      data: 4,
      isLoading: true,
      abortController: controller,
    }).mapError(mapper);
    expect(mapper).not.toHaveBeenCalled();
    expect(state.get()).toBe(4);
    expect(state.isLoading).toBe(true);
    expect(state.abortController).toBe(controller);
  });
});

describe("flatMap", () => {
  it("flattens the inner AsyncData when data is present", () => {
    const state = new AsyncData<number>({ data: 1 }).flatMap(
      n => new AsyncData<string>({ data: `#${n}` }),
    );
    expect(state.get()).toBe("#1");
  });

  it("skips the mapper when empty and passes loading state through", () => {
    const mapper = vi.fn(() => new AsyncData<string>());
    const state = new AsyncData<number>({ isLoading: true }).flatMap(mapper);
    expect(mapper).not.toHaveBeenCalled();
    expect(state.get()).toBeUndefined();
    expect(state.isLoading).toBe(true);
  });

  it("skips the mapper on an error state (withError clears data)", () => {
    const mapper = vi.fn(() => new AsyncData<string, string>());
    const state = new AsyncData<number, string>({ data: 1 })
      .withError("outer failed")
      .flatMap(mapper);
    expect(mapper).not.toHaveBeenCalled();
    expect(state.error).toBe("outer failed");
  });

  it("is loading when either side is loading", () => {
    const outer = new AsyncData<number>({ data: 1, isLoading: true }).flatMap(
      () => new AsyncData<string>({ data: "x" }),
    );
    expect(outer.isLoading).toBe(true);

    const inner = new AsyncData<number>({ data: 1 }).flatMap(
      () => new AsyncData<string>({ data: "x", isLoading: true }),
    );
    expect(inner.isLoading).toBe(true);
  });

  it("carries the inner error", () => {
    const state = new AsyncData<number, string>({ data: 1 }).flatMap(
      () => new AsyncData<string, string>({ error: "inner failed" }),
    );
    expect(state.error).toBe("inner failed");
  });

  it("prefers the inner abortController, falling back to the outer", () => {
    const outerCtrl = new AbortController();
    const innerCtrl = new AbortController();

    const withInner = new AsyncData<number>({ data: 1, abortController: outerCtrl }).flatMap(
      () => new AsyncData<string>({ data: "x", abortController: innerCtrl }),
    );
    expect(withInner.abortController).toBe(innerCtrl);

    const withoutInner = new AsyncData<number>({ data: 1, abortController: outerCtrl }).flatMap(
      () => new AsyncData<string>({ data: "x" }),
    );
    expect(withoutInner.abortController).toBe(outerCtrl);
  });
});

describe("combine", () => {
  const loaded = <T,>(data: T) => new AsyncData<T, string>({ data });

  it("produces a typed tuple when all have data", () => {
    const state = AsyncData.combine(loaded(1), loaded("a"), loaded(true));
    expect(state.get()).toEqual([1, "a", true]);
  });

  it("works with a single argument", () => {
    expect(AsyncData.combine(loaded(5)).get()).toEqual([5]);
  });

  it("works with four arguments", () => {
    expect(AsyncData.combine(loaded(1), loaded(2), loaded(3), loaded(4)).get()).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("treats falsy data values as present", () => {
    expect(AsyncData.combine(loaded(0), loaded("")).get()).toEqual([0, ""]);
  });

  it("is empty and loading when any source is loading without data", () => {
    const state = AsyncData.combine(loaded(1), new AsyncData<string, string>({ isLoading: true }));
    expect(state.get()).toBeUndefined();
    expect(state.isLoading).toBe(true);
  });

  it("keeps data while loading when all have data (stale-while-revalidate)", () => {
    const refetching = loaded(2).withLoading();
    const state = AsyncData.combine(loaded(1), refetching);
    expect(state.get()).toEqual([1, 2]);
    expect(state.isLoading).toBe(true);
  });

  it("carries the first error and drops data", () => {
    const state = AsyncData.combine(
      new AsyncData<number, string>({ error: "first" }),
      new AsyncData<string, string>({ error: "second" }),
      loaded(true),
    );
    expect(state.error).toBe("first");
    expect(state.get()).toBeUndefined();
  });

  it("is empty (not loading) when any source is a blank slate", () => {
    const state = AsyncData.combine(loaded(1), new AsyncData<string, string>());
    expect(state.get()).toBeUndefined();
    expect(state.isLoading).toBe(false);
  });

  it("survives a map without losing the loading flag", () => {
    // Regression: map() used to reset isLoading, silently breaking SWR pipelines
    const state = AsyncData.combine(loaded(2), loaded(3).withLoading()).map(([a, b]) => a * b);
    expect(state.get()).toBe(6);
    expect(state.isLoading).toBe(true);
  });
});
