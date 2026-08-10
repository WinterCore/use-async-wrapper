import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AsyncData, useAsyncWrapper } from "../src";
import { useQueryAsyncData } from "../src/react-query";
import {
  Btn,
  ButtonRow,
  Demo,
  ErrorBanner,
  mockProducts,
  sleep,
  Spinner,
  StatePanel,
  type Product,
} from "./helpers";

const meta = {
  title: "React Query/Bridge",
  decorators: [
    Story => {
      const [client] = React.useState(
        () =>
          new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
          }),
      );
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// A tiny fake backend the buttons can mutate between refetches.
// ---------------------------------------------------------------------------

const server = {
  fail: false,
  discount: 0,
  rate: 0.92,
};

const fetchProducts = async (): Promise<Product[]> => {
  await sleep(1200);
  if (server.fail) throw new Error("HTTP 500 — products service exploded");
  return mockProducts.map(p => ({ ...p, price: Math.round(p.price * (1 - server.discount)) }));
};

const fetchRate = async (): Promise<number> => {
  await sleep(800);
  return server.rate;
};

// ---------------------------------------------------------------------------

const SingleQueryDemo = () => {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const products = useQueryAsyncData(productsQuery, { mapError: e => e.message });

  const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError, AsyncWrapperLoading } =
    useAsyncWrapper(products);

  return (
    <Demo
      intro={
        <>
          A real <code>useQuery</code> bridged into <code>AsyncData</code> via{" "}
          <code>useQueryAsyncData</code>. React Query's <code>isFetching</code> maps to{" "}
          <code>isLoading</code> and cached data is preserved, so refetches flow straight into{" "}
          <code>renderLoading="no-data"</code>. Toggle server failure and refetch to see{" "}
          <code>mapError</code> deliver a typed string.
        </>
      }
      controls={
        <>
          <ButtonRow label="query">
            <Btn onClick={() => void productsQuery.refetch()}>refetch</Btn>
            <Btn onClick={() => void queryClient.invalidateQueries({ queryKey: ["products"] })}>
              invalidate
            </Btn>
            <Btn onClick={() => queryClient.removeQueries({ queryKey: ["products"] })}>
              drop cache
            </Btn>
          </ButtonRow>
          <ButtonRow label="server">
            <Btn
              onClick={() => {
                server.fail = !server.fail;
              }}
            >
              toggle failure (then refetch)
            </Btn>
            <Btn
              onClick={() => {
                server.discount = server.discount === 0 ? 0.25 : 0;
              }}
            >
              toggle 25% sale (then refetch)
            </Btn>
          </ButtonRow>
        </>
      }
      output={
        <AsyncWrapper renderLoading="no-data">
          <AsyncWrapperLoading>
            <Spinner />
          </AsyncWrapperLoading>
          <AsyncWrapperError>{error => <ErrorBanner message={error} />}</AsyncWrapperError>
          <AsyncWrapperData>
            {(products, isLoading) => (
              <div style={{ opacity: isLoading ? 0.5 : 1 }}>
                {isLoading && (
                  <div>
                    <Spinner small /> <em style={{ fontSize: 12 }}>refetching…</em>
                  </div>
                )}
                <ul style={{ margin: 0 }}>
                  {products.map(p => (
                    <li key={p.id}>
                      {p.name} — ${p.price}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AsyncWrapperData>
        </AsyncWrapper>
      }
      panels={<StatePanel label="bridged" state={products} />}
      code={`
const productsQuery = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

const products = useQueryAsyncData(productsQuery, { mapError: e => e.message });
// AsyncData<Product[], string>

const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError } =
  useAsyncWrapper(products);

<AsyncWrapper renderLoading="no-data">
  <AsyncWrapperError>{(error) => <ErrorBanner message={error} />}</AsyncWrapperError>
  <AsyncWrapperData>
    {(products, isLoading) => <ProductList products={products} dimmed={isLoading} />}
  </AsyncWrapperData>
</AsyncWrapper>`}
    />
  );
};

export const SingleQuery: Story = {
  render: () => <SingleQueryDemo />,
};

// ---------------------------------------------------------------------------

const TwoQueriesDemo = () => {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const rateQuery = useQuery({ queryKey: ["rate"], queryFn: fetchRate });

  const products = useQueryAsyncData(productsQuery, { mapError: e => e.message });
  const rate = useQueryAsyncData(rateQuery, { mapError: e => e.message });

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
          Two live queries, bridged and combined. Change the server-side rate and invalidate
          only the rate query: the product list stays visible with stale prices while just
          that query refetches — cross-query stale-while-revalidate with zero bookkeeping.
        </>
      }
      controls={
        <ButtonRow>
          <Btn
            onClick={() => {
              server.rate = server.rate === 0.92 ? 1.35 : 0.92;
              void queryClient.invalidateQueries({ queryKey: ["rate"] });
            }}
          >
            change rate + invalidate rate query
          </Btn>
          <Btn onClick={() => void queryClient.invalidateQueries()}>invalidate both</Btn>
        </ButtonRow>
      }
      output={
        <AsyncWrapper renderLoading="no-data">
          <AsyncWrapperLoading>
            <Spinner />
          </AsyncWrapperLoading>
          <AsyncWrapperError>{error => <ErrorBanner message={error} />}</AsyncWrapperError>
          <AsyncWrapperData>
            {(products, isLoading) => (
              <div style={{ opacity: isLoading ? 0.5 : 1 }}>
                {isLoading && (
                  <div>
                    <Spinner small /> <em style={{ fontSize: 12 }}>updating prices…</em>
                  </div>
                )}
                <ul style={{ margin: 0 }}>
                  {products.map(p => (
                    <li key={p.id}>
                      {p.name} — €{p.price}
                    </li>
                  ))}
                </ul>
              </div>
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
const products = useQueryAsyncData(productsQuery, { mapError: e => e.message });
const rate = useQueryAsyncData(rateQuery, { mapError: e => e.message });

const converted = useMemo(
  () => AsyncData.combine(products, rate)
    .map(([products, rate]) =>
      products.map(p => ({ ...p, price: p.price * rate }))),
  [products, rate],
);

// Invalidating just the rate query:
// rate → { data: 0.92 (stale), isLoading: true }
// combined → data + isLoading — the list stays visible, dimmed`}
    />
  );
};

export const CombineTwoQueries: Story = {
  render: () => <TwoQueriesDemo />,
};
