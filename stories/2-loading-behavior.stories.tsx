import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AsyncData, useAsyncWrapper } from "../src";
import {
  Btn,
  ButtonRow,
  Demo,
  mockProducts,
  Spinner,
  StatePanel,
  type Product,
} from "./helpers";

interface LoadingArgs {
  renderLoading: "always" | "no-data";
}

const meta: Meta<LoadingArgs> = {
  title: "AsyncWrapper/Loading Behavior",
  args: { renderLoading: "no-data" },
  argTypes: {
    renderLoading: {
      control: "radio",
      options: ["always", "no-data"],
      description: "AsyncWrapper's renderLoading prop",
    },
  },
};

export default meta;
type Story = StoryObj<LoadingArgs>;

// ---------------------------------------------------------------------------

const jitter = (products: Product[]) =>
  products.map(p => ({ ...p, price: Math.round(p.price * (0.9 + Math.random() * 0.2)) }));

const LoadingDemo = ({ renderLoading }: LoadingArgs) => {
  const [products, setProducts] = React.useState(new AsyncData<Product[]>());
  const { AsyncWrapper, AsyncWrapperData, AsyncWrapperLoading } = useAsyncWrapper(products);

  return (
    <Demo
      intro={
        <>
          Use the <strong>renderLoading</strong> control (Controls panel) to switch modes, then
          press <em>refetch</em> while data is present. <code>'always'</code> replaces the list
          with the spinner on every load; <code>'no-data'</code> keeps stale data visible and
          passes <code>isLoading</code> to the data child — stale-while-revalidate.
        </>
      }
      controls={
        <ButtonRow>
          <Btn onClick={() => setProducts(prev => prev.withLoading())}>
            refetch — withLoading()
          </Btn>
          <Btn onClick={() => setProducts(prev => prev.withData(jitter(mockProducts)))}>
            resolve — withData(...)
          </Btn>
          <Btn onClick={() => setProducts(prev => prev.withError("Price service unavailable"))}>
            fail — withError(...)
          </Btn>
          <Btn onClick={() => setProducts(new AsyncData<Product[]>())}>reset</Btn>
        </ButtonRow>
      }
      output={
        <AsyncWrapper renderLoading={renderLoading}>
          <AsyncWrapperLoading>
            <Spinner />
          </AsyncWrapperLoading>
          <AsyncWrapperData>
            {(products, isLoading) => (
              <div style={{ opacity: isLoading ? 0.5 : 1, transition: "opacity 0.2s" }}>
                {isLoading && (
                  <div style={{ marginBottom: 8 }}>
                    <Spinner small /> <em style={{ fontSize: 12 }}>refreshing…</em>
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
      panels={<StatePanel label="products" state={products} />}
      code={`
<AsyncWrapper renderLoading="${renderLoading}">
  <AsyncWrapperLoading>
    <Spinner />
  </AsyncWrapperLoading>
  <AsyncWrapperData>
    {(products, isLoading) => (
      <div style={{ opacity: isLoading ? 0.5 : 1 }}>
        {isLoading && <SmallSpinner />}
        <ProductList products={products} />
      </div>
    )}
  </AsyncWrapperData>
</AsyncWrapper>

// renderLoading="always":  data + isLoading → spinner replaces the list
// renderLoading="no-data": data + isLoading → list stays, isLoading = true`}
    />
  );
};

/**
 * Full loading UI on every fetch — stale data is hidden while refetching.
 */
export const Always: Story = {
  args: { renderLoading: "always" },
  render: args => <LoadingDemo {...args} />,
};

/**
 * Loading UI only before first data — refetches keep stale data visible.
 */
export const StaleWhileRevalidate: Story = {
  args: { renderLoading: "no-data" },
  render: args => <LoadingDemo {...args} />,
};

// ---------------------------------------------------------------------------

const StatePriorityDemo = () => {
  const [state, setState] = React.useState(new AsyncData<Product[]>());
  const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError, AsyncWrapperLoading } =
    useAsyncWrapper(state);

  return (
    <Demo
      intro={
        <>
          States resolve in priority order: <strong>error → loading → empty → data</strong>.
          Try "error while loading" — the error wins. Try "data + loading" with the default
          <code> renderLoading="always"</code> — loading wins over stale data.
        </>
      }
      controls={
        <ButtonRow>
          <Btn
            onClick={() =>
              setState(new AsyncData<Product[]>({ error: "Boom", isLoading: true }))
            }
          >
            error while loading
          </Btn>
          <Btn
            onClick={() =>
              setState(new AsyncData<Product[]>({ data: mockProducts, isLoading: true }))
            }
          >
            data + loading
          </Btn>
          <Btn onClick={() => setState(new AsyncData<Product[]>({ data: mockProducts }))}>
            data only
          </Btn>
          <Btn onClick={() => setState(new AsyncData<Product[]>())}>empty</Btn>
        </ButtonRow>
      }
      output={
        <AsyncWrapper>
          <AsyncWrapperLoading>
            <Spinner /> <em style={{ fontSize: 12 }}>loading state won</em>
          </AsyncWrapperLoading>
          <AsyncWrapperError>
            {error => <strong style={{ color: "#c0392b" }}>error state won: {error}</strong>}
          </AsyncWrapperError>
          <AsyncWrapperData>
            {products => <span>data state won: {products.length} products</span>}
          </AsyncWrapperData>
        </AsyncWrapper>
      }
      panels={<StatePanel label="state" state={state} />}
      code={`
// AsyncWrapper resolves exactly one state, in this order:
// 1. Error   — error !== null
// 2. Loading — isLoading && renderLoading condition met
// 3. Empty   — data is still Empty → renders nothing
// 4. Data    — renders AsyncWrapperData

new AsyncData({ error: 'Boom', isLoading: true }) // → error state
new AsyncData({ data: products, isLoading: true }) // → loading ('always')
new AsyncData({ data: products })                  // → data state
new AsyncData()                                    // → empty, renders nothing`}
    />
  );
};

export const StatePriority: Story = {
  render: () => <StatePriorityDemo />,
};
