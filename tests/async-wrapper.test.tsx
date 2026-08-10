import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AsyncData, useAsyncWrapper } from "../src";

afterEach(cleanup);

type Props = {
  state: AsyncData<string[], string>;
  renderLoading?: "always" | "no-data";
  dontRenderDefaultLoading?: boolean;
  dontRenderDefaultError?: boolean;
};

/** Wrapper with all three custom state children. */
const Full = ({ state, ...wrapperProps }: Props) => {
  const { AsyncWrapper, AsyncWrapperData, AsyncWrapperError, AsyncWrapperLoading } =
    useAsyncWrapper(state);
  return (
    <AsyncWrapper {...wrapperProps}>
      <AsyncWrapperLoading>
        <div>custom-loading</div>
      </AsyncWrapperLoading>
      <AsyncWrapperError>{error => <div>custom-error:{error}</div>}</AsyncWrapperError>
      <AsyncWrapperData>
        {(data, isLoading) => <div>data:{data.join(",")}:{String(isLoading)}</div>}
      </AsyncWrapperData>
    </AsyncWrapper>
  );
};

/** Wrapper with only a data child — exercises default fallbacks. */
const DataOnly = ({ state, ...wrapperProps }: Props) => {
  const { AsyncWrapper, AsyncWrapperData } = useAsyncWrapper(state);
  return (
    <AsyncWrapper {...wrapperProps}>
      <AsyncWrapperData>{data => <div>data:{data.join(",")}</div>}</AsyncWrapperData>
    </AsyncWrapper>
  );
};

const empty = () => new AsyncData<string[], string>();
const loading = () => empty().withLoading();
const withData = (...items: string[]) => empty().withData(items);
const withError = (message: string) => empty().withError(message);

describe("default fallbacks", () => {
  it("renders the default loading fallback", () => {
    const { container } = render(<DataOnly state={loading()} />);
    expect(container.textContent).toBe("Loading...");
  });

  it("renders the default error fallback", () => {
    const { container } = render(<DataOnly state={withError("boom")} />);
    expect(container.textContent).toBe("Error: boom");
  });

  it("suppresses the default loading fallback with dontRenderDefaultLoading", () => {
    const { container } = render(<DataOnly state={loading()} dontRenderDefaultLoading />);
    expect(container.textContent).toBe("");
  });

  it("suppresses the default error fallback with dontRenderDefaultError", () => {
    const { container } = render(<DataOnly state={withError("boom")} dontRenderDefaultError />);
    expect(container.textContent).toBe("");
  });
});

describe("custom state children", () => {
  it("renders the custom loading child instead of the default", () => {
    const { container } = render(<Full state={loading()} />);
    expect(container.textContent).toBe("custom-loading");
  });

  it("passes the typed error to the custom error child", () => {
    const { container } = render(<Full state={withError("service down")} />);
    expect(container.textContent).toBe("custom-error:service down");
  });

  it("passes data and isLoading to the data child", () => {
    const { container } = render(<Full state={withData("a", "b")} />);
    expect(container.textContent).toBe("data:a,b:false");
  });
});

describe("state priority", () => {
  it("renders nothing for the empty state", () => {
    const { container } = render(<Full state={empty()} />);
    expect(container.textContent).toBe("");
  });

  it("error wins over loading", () => {
    const state = new AsyncData<string[], string>({ error: "boom", isLoading: true });
    const { container } = render(<Full state={state} />);
    expect(container.textContent).toBe("custom-error:boom");
  });

  it("loading wins over stale data with renderLoading='always' (default)", () => {
    const state = withData("a").withLoading();
    const { container } = render(<Full state={state} />);
    expect(container.textContent).toBe("custom-loading");
  });
});

describe("renderLoading='no-data'", () => {
  it("shows loading before any data exists", () => {
    const { container } = render(<Full state={loading()} renderLoading="no-data" />);
    expect(container.textContent).toBe("custom-loading");
  });

  it("keeps stale data visible during a refetch, with isLoading=true", () => {
    const state = withData("a").withLoading();
    const { container } = render(<Full state={state} renderLoading="no-data" />);
    expect(container.textContent).toBe("data:a:true");
  });
});

describe("children handling", () => {
  it("always renders non-state children", () => {
    const Harness = ({ state }: Props) => {
      const { AsyncWrapper, AsyncWrapperData } = useAsyncWrapper(state);
      return (
        <AsyncWrapper dontRenderDefaultLoading>
          <h1>static</h1>
          <AsyncWrapperData>{data => <div>data:{data.join(",")}</div>}</AsyncWrapperData>
        </AsyncWrapper>
      );
    };

    const { container, rerender } = render(<Harness state={loading()} />);
    expect(container.textContent).toBe("static");

    rerender(<Harness state={withData("a")} />);
    expect(container.textContent).toBe("staticdata:a");
  });

  it("renders state components nested below the direct-children level", () => {
    const Harness = ({ state }: Props) => {
      const { AsyncWrapper, AsyncWrapperData } = useAsyncWrapper(state);
      return (
        <AsyncWrapper>
          <div>
            <AsyncWrapperData>{data => <span>nested:{data.join(",")}</span>}</AsyncWrapperData>
          </div>
        </AsyncWrapper>
      );
    };

    const { container } = render(<Harness state={withData("x")} />);
    expect(container.textContent).toBe("nested:x");
  });

  it("nested loading children do not suppress the default fallback (documented caveat)", () => {
    const Harness = ({ state }: Props) => {
      const { AsyncWrapper, AsyncWrapperLoading } = useAsyncWrapper(state);
      return (
        <AsyncWrapper>
          <div>
            <AsyncWrapperLoading>
              <span>nested-loading</span>
            </AsyncWrapperLoading>
          </div>
        </AsyncWrapper>
      );
    };

    const { container } = render(<Harness state={loading()} />);
    // Both render: detection only sees direct children
    expect(container.textContent).toContain("nested-loading");
    expect(container.textContent).toContain("Loading...");
  });

  it("throws when a state component is used outside AsyncWrapper", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const Naked = () => {
      const { AsyncWrapperData } = useAsyncWrapper(empty());
      return <AsyncWrapperData>{() => null}</AsyncWrapperData>;
    };

    expect(() => render(<Naked />)).toThrow("AsyncWrapperData must be used within an AsyncWrapper");
    spy.mockRestore();
  });
});

describe("useAsyncWrapper stability", () => {
  it("updates data across re-renders without remounting the subtree", () => {
    const mountSpy = vi.fn();
    const Leaf = ({ value }: { value: string }) => {
      React.useEffect(() => mountSpy(), []);
      return <span>{value}</span>;
    };

    const Harness = ({ state }: Props) => {
      const { AsyncWrapper, AsyncWrapperData } = useAsyncWrapper(state);
      return (
        <AsyncWrapper>
          <AsyncWrapperData>{data => <Leaf value={data.join(",")} />}</AsyncWrapperData>
        </AsyncWrapper>
      );
    };

    const { container, rerender } = render(<Harness state={withData("a")} />);
    expect(container.textContent).toBe("a");

    rerender(<Harness state={withData("b")} />);
    expect(container.textContent).toBe("b");
    expect(mountSpy).toHaveBeenCalledTimes(1); // updated in place, not remounted
  });
});
