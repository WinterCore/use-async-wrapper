import React from "react";
import { AsyncData } from "../src/async-data";

// ---------------------------------------------------------------------------
// Mock domain data
// ---------------------------------------------------------------------------

export interface Product {
  id: number;
  name: string;
  price: number;
}

export interface User {
  id: number;
  name: string;
}

export interface Post {
  id: number;
  title: string;
}

export const mockProducts: Product[] = [
  { id: 1, name: "Keyboard", price: 80 },
  { id: 2, name: "Mouse", price: 40 },
  { id: 3, name: "Monitor", price: 300 },
];

export const mockUsers: User[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Basim" },
  { id: 3, name: "Chen" },
];

export const mockPostsByUser: Record<number, Post[]> = {
  1: [
    { id: 11, title: "Why I love keyboards" },
    { id: 12, title: "Mechanical switches, ranked" },
  ],
  2: [{ id: 21, title: "A single, perfect post" }],
  3: [],
};

export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Demo UI primitives
// ---------------------------------------------------------------------------

// Injected once so buttons get real :hover / :active affordances (inline styles can't).
if (typeof document !== "undefined" && !document.getElementById("uaw-btn-styles")) {
  const el = document.createElement("style");
  el.id = "uaw-btn-styles";
  el.textContent = `
    .uaw-btn {
      padding: 7px 14px;
      border: 1px solid #b6bcc4;
      border-bottom-color: #9aa1ab;
      border-radius: 7px;
      background: linear-gradient(#ffffff, #eef0f3);
      box-shadow: 0 1px 2px rgba(20, 30, 50, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9);
      color: #1f2937;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.1s, box-shadow 0.1s, transform 0.05s;
    }
    .uaw-btn:hover:not(:disabled) {
      background: linear-gradient(#fbfcfe, #e2e6eb);
      border-color: #8b93a0;
    }
    .uaw-btn:active:not(:disabled) {
      background: #dde1e7;
      box-shadow: inset 0 2px 3px rgba(20, 30, 50, 0.18);
      transform: translateY(1px);
    }
    .uaw-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(el);
}

export const Btn = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" className={`uaw-btn ${className ?? ""}`} {...props} />
);

export const ButtonRow = ({ label, children }: { label?: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
    {label && <span style={{ fontSize: 12, color: "#888", minWidth: 90 }}>{label}</span>}
    {children}
  </div>
);

/** Live view of an AsyncData instance's internals. */
export const StatePanel = <T, E>({ label, state }: { label: string; state: AsyncData<T, E> }) => {
  const dataText =
    state.data === AsyncData.Empty ? "Empty" : JSON.stringify(state.data);

  const badge = (color: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontFamily: "monospace",
    background: color,
    color: "#fff",
  });

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", padding: "4px 0" }}>
      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 90 }}>{label}</span>
      <span style={badge(state.isLoading ? "#e67e22" : "#95a5a6")}>
        {state.isLoading ? "isLoading: true" : "isLoading: false"}
      </span>
      <span style={badge(state.error !== null ? "#c0392b" : "#95a5a6")}>
        {state.error !== null ? `error: ${JSON.stringify(state.error)}` : "error: null"}
      </span>
      <span style={badge(state.data === AsyncData.Empty ? "#95a5a6" : "#27ae60")}>
        {"data: "}
        {dataText.length > 60 ? dataText.slice(0, 60) + "…" : dataText}
      </span>
      {state.abortController && <span style={badge("#8e44ad")}>abortController: set</span>}
    </div>
  );
};

/** Renders a code snippet below the demo. */
export const CodeBlock = ({ code }: { code: string }) => (
  <details open style={{ marginTop: 16 }}>
    <summary style={{ cursor: "pointer", fontSize: 13, color: "#666", userSelect: "none" }}>
      Code
    </summary>
    <pre
      style={{
        background: "#1e1e2e",
        color: "#cdd6f4",
        padding: 16,
        borderRadius: 8,
        fontSize: 12.5,
        lineHeight: 1.55,
        overflowX: "auto",
        marginTop: 8,
      }}
    >
      <code>{code.trim()}</code>
    </pre>
  </details>
);

/** Standard demo layout: intro → controls → live output → state panels → code. */
export const Demo = ({
  intro,
  controls,
  output,
  panels,
  code,
}: {
  intro?: React.ReactNode;
  controls: React.ReactNode;
  output: React.ReactNode;
  panels?: React.ReactNode;
  code: string;
}) => (
  <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 760 }}>
    {intro && <p style={{ fontSize: 13.5, color: "#555", marginTop: 0 }}>{intro}</p>}
    {controls}
    <div
      style={{
        border: "1px dashed #bbb",
        borderRadius: 8,
        padding: 16,
        minHeight: 70,
        marginTop: 8,
      }}
    >
      {output}
    </div>
    {panels && (
      <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 8 }}>{panels}</div>
    )}
    <CodeBlock code={code} />
  </div>
);

export const Spinner = ({ small }: { small?: boolean }) => (
  <span
    aria-label="loading"
    style={{
      display: "inline-block",
      width: small ? 14 : 28,
      height: small ? 14 : 28,
      border: `${small ? 2 : 3}px solid #ddd`,
      borderTopColor: "#3498db",
      borderRadius: "50%",
      animation: "uaw-spin 0.8s linear infinite",
      verticalAlign: "middle",
    }}
  >
    <style>{"@keyframes uaw-spin { to { transform: rotate(360deg); } }"}</style>
  </span>
);

export const ErrorBanner = ({ message }: { message: string }) => (
  <div
    style={{
      background: "#fdecea",
      border: "1px solid #e74c3c",
      color: "#c0392b",
      borderRadius: 6,
      padding: "8px 12px",
      fontSize: 13.5,
    }}
  >
    ⚠ {message}
  </div>
);
