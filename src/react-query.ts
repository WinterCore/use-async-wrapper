import { useMemo, useRef } from "react";
import { type UseQueryResult } from "@tanstack/react-query";

import { AsyncData } from "./async-data";

type QueryToAsyncDataOptions<TError, TMappedError> = {
  mapError?: (error: TError) => TMappedError;
};

type QueryToAsyncDataInput<TData, TError> = Pick<
  UseQueryResult<TData, TError>,
  'data' | 'error' | 'isError' | 'isFetching'
>;

/**
 * Converts the relevant React Query state fields into an `AsyncData`.
 *
 * State priority intentionally mirrors `AsyncWrapper`: errors win over cached data,
 * then loaded data, then loading/empty state. `undefined` is treated as "not loaded",
 * so do not use this helper for queries where `undefined` is a valid payload.
 */
export function queryToAsyncData<TData, TError = Error, TMappedError = TError>(
  query: QueryToAsyncDataInput<TData, TError>,
  options: QueryToAsyncDataOptions<TError, TMappedError> = {},
): AsyncData<TData, TMappedError> {
  if (query.isError && query.error !== null) {
    return new AsyncData<TData, TMappedError>({
      error: options.mapError
        ? options.mapError(query.error)
        : (query.error as unknown as TMappedError),
      isLoading: query.isFetching,
    });
  }

  if (query.data !== undefined) {
    return new AsyncData<TData, TMappedError>({
      data: query.data,
      isLoading: query.isFetching,
    });
  }

  return new AsyncData<TData, TMappedError>({ isLoading: query.isFetching });
}

/**
 * Memoized React hook wrapper around `queryToAsyncData`.
 *
 * `mapError` is read through a ref so callers can pass inline mapper functions without
 * creating a new `AsyncData` instance on every render. The converted state only changes
 * when the query's data/error/loading fields change.
 */
export function useQueryAsyncData<TData, TError = Error, TMappedError = TError>(
  query: QueryToAsyncDataInput<TData, TError>,
  options: QueryToAsyncDataOptions<TError, TMappedError> = {},
): AsyncData<TData, TMappedError> {
  const { data, error, isError, isFetching } = query;
  const mapErrorRef = useRef(options.mapError);
  mapErrorRef.current = options.mapError;

  return useMemo(
    () => queryToAsyncData({ data, error, isError, isFetching }, { mapError: mapErrorRef.current }),
    [data, error, isError, isFetching],
  );
}
