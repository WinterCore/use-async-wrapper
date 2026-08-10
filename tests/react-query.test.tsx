import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { queryToAsyncData, useQueryAsyncData } from "../src/react-query";

afterEach(cleanup);

type Input<T> = {
  data: T | undefined;
  error: Error | null;
  isError: boolean;
  isFetching: boolean;
};

const pending: Input<number> = { data: undefined, error: null, isError: false, isFetching: true };
const success: Input<number> = { data: 42, error: null, isError: false, isFetching: false };
const refetching: Input<number> = { data: 42, error: null, isError: false, isFetching: true };
const failed = (message: string, extra: Partial<Input<number>> = {}): Input<number> => ({
  data: undefined,
  error: new Error(message),
  isError: true,
  isFetching: false,
  ...extra,
});

describe("queryToAsyncData", () => {
  it("maps a pending query to empty + loading", () => {
    const state = queryToAsyncData(pending);
    expect(state.get()).toBeUndefined();
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it("maps a successful query to data", () => {
    const state = queryToAsyncData(success);
    expect(state.get()).toBe(42);
    expect(state.isLoading).toBe(false);
  });

  it("maps a background refetch to data + loading (stale-while-revalidate)", () => {
    const state = queryToAsyncData(refetching);
    expect(state.get()).toBe(42);
    expect(state.isLoading).toBe(true);
  });

  it("maps a blank query to empty, not loading", () => {
    const state = queryToAsyncData({ ...pending, isFetching: false });
    expect(state.get()).toBeUndefined();
    expect(state.isLoading).toBe(false);
  });

  it("passes the error through untouched without mapError", () => {
    const state = queryToAsyncData(failed("boom"));
    expect(state.error).toBeInstanceOf(Error);
    expect((state.error as Error).message).toBe("boom");
  });

  it("applies mapError to convert the error type", () => {
    const state = queryToAsyncData(failed("boom"), { mapError: e => e.message });
    expect(state.error).toBe("boom");
  });

  it("errors win over cached data", () => {
    const state = queryToAsyncData(failed("boom", { data: 42 }), { mapError: e => e.message });
    expect(state.error).toBe("boom");
    expect(state.get()).toBeUndefined();
  });

  it("preserves isFetching in the error state", () => {
    const state = queryToAsyncData(failed("boom", { isFetching: true }));
    expect(state.isLoading).toBe(true);
  });
});

describe("useQueryAsyncData", () => {
  it("returns a referentially stable instance while query fields are unchanged", () => {
    const { result, rerender } = renderHook(
      ({ query }) => useQueryAsyncData(query, { mapError: e => e.message }),
      { initialProps: { query: success } },
    );

    const first = result.current;
    // New object identity + new inline mapError, but identical fields
    rerender({ query: { ...success } });
    expect(result.current).toBe(first);
  });

  it("returns a new instance when a query field changes", () => {
    const { result, rerender } = renderHook(
      ({ query }) => useQueryAsyncData(query, { mapError: e => e.message }),
      { initialProps: { query: pending } },
    );

    const first = result.current;
    expect(first.isLoading).toBe(true);

    rerender({ query: success });
    expect(result.current).not.toBe(first);
    expect(result.current.get()).toBe(42);
    expect(result.current.isLoading).toBe(false);
  });

  it("uses the latest mapError when the state recomputes", () => {
    const { result, rerender } = renderHook(
      ({ query, prefix }: { query: Input<number>; prefix: string }) =>
        useQueryAsyncData(query, { mapError: e => `${prefix}${e.message}` }),
      { initialProps: { query: success, prefix: "old:" } },
    );

    // Swapping the mapper alone does not recompute (fields unchanged)...
    const stable = result.current;
    rerender({ query: success, prefix: "new:" });
    expect(result.current).toBe(stable);

    // ...but the next field change applies the latest mapper
    rerender({ query: failed("boom"), prefix: "new:" });
    expect(result.current.error).toBe("new:boom");
  });
});
