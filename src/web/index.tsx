import React, { useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { Report, ReportOutput, ReportInput } from "../types";

const REPO_URL = "https://github.com/ANIRUDH-SJ/coin-smith";

// ─── Icons ────────────────────────────────────────────────────────────────────

const GitHubIcon = () => (
  <svg height="26" width="26" viewBox="0 0 16 16" fill="currentColor" aria-label="GitHub">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
      0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
      -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
      .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
      -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
      1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
      1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
      1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

// ─── Small reusable pieces ────────────────────────────────────────────────────

const Pill = ({
  label,
  bg = "#ddd",
  fg = "#111",
}: {
  label: string;
  bg?: string;
  fg?: string;
}) => (
  <span
    style={{
      background: bg,
      color: fg,
      fontSize: "0.6rem",
      fontFamily: "var(--mono)",
      textTransform: "uppercase",
      padding: "2px 6px",
      fontWeight: 700,
      letterSpacing: "0.04em",
    }}
  >
    {label}
  </span>
);

const Callout = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: "#fffbeb",
      borderLeft: "3px solid #e5a800",
      padding: "0.75rem 1rem",
      fontSize: "0.875rem",
      lineHeight: 1.7,
      color: "#444",
      marginBottom: "1.25rem",
    }}
  >
    {children}
  </div>
);

const SectionCard = ({
  title,
  concept,
  children,
}: {
  title: string;
  concept?: string;
  children: React.ReactNode;
}) => (
  <div
    style={{
      border: "1px solid #111",
      background: "#fff",
      padding: "1.5rem",
      boxShadow: "4px 4px 0 #111",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        borderBottom: "1px solid #eee",
        paddingBottom: "0.625rem",
        marginBottom: "1.125rem",
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: "0.7rem",
          textTransform: "uppercase",
          color: "#444",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </span>
      {concept && <Pill label={concept} bg="#111" fg="#fff" />}
    </div>
    {children}
  </div>
);

// ─── Transaction flow bar ─────────────────────────────────────────────────────

const FlowDiagram = ({ report }: { report: Report }) => {
  const totalIn = report.selected_inputs.reduce((s, i) => s + i.value_sats, 0);
  const payments = report.outputs.filter((o) => !o.is_change);
  const change = report.outputs.find((o) => o.is_change);
  const pct = (v: number) => `${((v / totalIn) * 100).toFixed(1)}%`;

  return (
    <div style={{ fontFamily: "var(--mono)" }}>
      {/* Input coins */}
      <div
        style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}
      >
        {report.selected_inputs.map((u, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 100,
              background: "#111",
              color: "#fff",
              padding: "0.5rem 0.75rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.55rem", opacity: 0.55, marginBottom: 2 }}>
              COIN {i + 1}
            </div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
              {u.value_sats.toLocaleString()}
            </div>
            <div style={{ fontSize: "0.55rem", opacity: 0.55 }}>sats</div>
          </div>
        ))}
      </div>

      <div
        style={{ textAlign: "center", fontSize: "1rem", color: "#888", margin: "0.25rem 0" }}
      >
        ↓
      </div>

      {/* Proportion bar */}
      <div
        style={{
          display: "flex",
          height: "2.25rem",
          border: "1px solid #111",
          marginBottom: "0.5rem",
          overflow: "hidden",
        }}
      >
        {payments.map((o, i) => (
          <div
            key={i}
            title={`Payment: ${o.value_sats.toLocaleString()} sats`}
            style={{
              width: pct(o.value_sats),
              background: "#111",
              borderRight: "1px solid #555",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "0.6rem",
              overflow: "hidden",
              whiteSpace: "nowrap",
              minWidth: 4,
            }}
          >
            {pct(o.value_sats)}
          </div>
        ))}
        {change && (
          <div
            title={`Change back to you: ${change.value_sats.toLocaleString()} sats`}
            style={{
              width: pct(change.value_sats),
              background: "var(--accent)",
              borderRight: "1px solid #ccc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "0.6rem",
              overflow: "hidden",
              whiteSpace: "nowrap",
              minWidth: 4,
            }}
          >
            {pct(change.value_sats)}
          </div>
        )}
        <div
          title={`Fee: ${report.fee_sats.toLocaleString()} sats`}
          style={{
            flex: 1,
            background: "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.6rem",
            color: "#555",
            minWidth: 4,
          }}
        >
          {pct(report.fee_sats)}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "1.25rem",
          fontSize: "0.72rem",
          color: "#666",
          flexWrap: "wrap",
        }}
      >
        <span>
          <span
            style={{ background: "#111", color: "#fff", padding: "0 5px", marginRight: 4 }}
          >
            ■
          </span>
          Payment
        </span>
        {change && (
          <span>
            <span
              style={{
                background: "var(--accent)",
                color: "#fff",
                padding: "0 5px",
                marginRight: 4,
              }}
            >
              ■
            </span>
            Change (back to you)
          </span>
        )}
        <span>
          <span style={{ background: "#e0e0e0", padding: "0 5px", marginRight: 4 }}>■</span>
          Fee (miners)
        </span>
      </div>
    </div>
  );
};

// ─── File upload zone ─────────────────────────────────────────────────────────

const FileUpload = ({ onFile }: { onFile: (file: File) => void }) => {
  const [drag, setDrag] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      if (e.dataTransfer.files?.[0]) onFile(e.dataTransfer.files[0]);
    },
    [onFile]
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) onFile(e.target.files[0]);
    },
    [onFile]
  );

  return (
    <div
      style={{
        border: `2px dashed ${drag ? "var(--accent)" : "#111"}`,
        padding: "3rem",
        textAlign: "center",
        cursor: "pointer",
        background: drag ? "#f5f0e8" : "#fff",
        transition: "all 0.15s",
        userSelect: "none",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => document.getElementById("file-input")?.click()}
    >
      <input
        type="file"
        id="file-input"
        accept=".json"
        style={{ display: "none" }}
        onChange={onChange}
      />
      <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.375rem" }}>
        DROP FIXTURE JSON HERE
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem", color: "#777" }}>
        or click to browse — accepts .json fixture files
      </div>
    </div>
  );
};

// ─── Warning explanations ─────────────────────────────────────────────────────

const WARNING_META: Record<string, { title: string; desc: string }> = {
  HIGH_FEE: {
    title: "High Fee",
    desc: "The fee is unusually large (over 1,000,000 sats total, or more than 200 sat/vB). This could be a mistake — double-check the amounts before signing.",
  },
  DUST_CHANGE: {
    title: "Dust Change Output",
    desc: "The change output is below 546 sats — what Bitcoin calls 'dust'. Outputs this tiny are impractical to spend later (the fee to spend them would exceed their value), and most nodes won't relay transactions that create them.",
  },
  SEND_ALL: {
    title: "Send All — No Change",
    desc: "The leftover after the payment was too small to return as change (it would be 'dust'), so the entire remainder became part of the fee. If you didn't intend to give away every sat, review the amounts.",
  },
  RBF_SIGNALING: {
    title: "RBF Enabled",
    desc: "This transaction opts into Replace-By-Fee. That means it can be replaced with a higher-fee version while it's still waiting to confirm — useful if the network is congested and you need to speed it up.",
  },
};

// ─── Main App ─────────────────────────────────────────────────────────────────

const App = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const build = async (json: unknown) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || "Build failed");
      setReport(data as Report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = useCallback(async (file: File) => {
    try {
      build(JSON.parse(await file.text()));
    } catch {
      setError("Could not parse JSON file.");
    }
  }, []);

  const handleLoadExample = async () => {
    try {
      const res = await fetch("/fixtures/basic_change_p2wpkh.json");
      if (!res.ok) throw new Error();
      build(await res.json());
    } catch {
      setError("Could not load example fixture.");
    }
  };

  const totalIn = report
    ? report.selected_inputs.reduce((s, i) => s + i.value_sats, 0)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* ── Header ── */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #111",
          paddingBottom: "1rem",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setReport(null);
            setError(null);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            font: "inherit",
            opacity: 1,
            transition: "opacity 0.15s",
          }}
          title="Back to home"
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.7")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
        >
          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-0.05em",
              textTransform: "uppercase",
            }}
          >
            Coin Smith
          </h1>
          <div
            style={{ fontFamily: "var(--mono)", fontSize: "0.8rem", opacity: 0.55, marginTop: 2 }}
          >
            Bitcoin PSBT Transaction Builder
          </div>
        </button>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#111",
            textDecoration: "none",
            opacity: 0.7,
            transition: "opacity 0.15s",
          }}
          title="View source on GitHub"
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.7")}
        >
          <GitHubIcon />
        </a>
      </header>

      {/* ── Upload Panel (hidden when result is shown) ── */}
      {!report && (
        <>
          <div
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              borderLeft: "3px solid #111",
              padding: "1rem 1.25rem",
              fontSize: "0.9rem",
              lineHeight: 1.75,
            }}
          >
            <strong>New to Bitcoin?</strong> A Bitcoin wallet doesn't hold money in one lump — it holds
            a collection of individual unspent coins called{" "}
            <strong>UTXOs (Unspent Transaction Outputs)</strong>. When you pay someone, the wallet
            picks coins to cover the amount, calculates a <strong>fee</strong> for miners, and packages
            everything into an unsigned document called a <strong>PSBT</strong> — ready for your
            signature. This tool shows you every step of that process.
          </div>

          <FileUpload onFile={handleFile} />

          <div style={{ textAlign: "center" }}>
            <button
              onClick={handleLoadExample}
              style={{
                background: "transparent",
                border: "1px solid #111",
                padding: "0.5rem 1.75rem",
                fontFamily: "var(--mono)",
                fontSize: "0.8rem",
                cursor: "pointer",
                textTransform: "uppercase",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              Load Example Fixture
            </button>
          </div>
        </>
      )}

      {loading && (
        <div style={{ textAlign: "center", fontFamily: "var(--mono)", padding: "2rem 0", color: "#888" }}>
          Building transaction...
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#fff0f0",
            border: "2px solid #cc0000",
            padding: "1rem 1.25rem",
            color: "#cc0000",
            fontFamily: "var(--mono)",
            fontSize: "0.875rem",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── Results ── */}
      {report && (
        <>
          {/* toolbar */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <button
              onClick={() => {
                setReport(null);
                setError(null);
              }}
              style={{
                background: "transparent",
                border: "1px solid #111",
                padding: "0.375rem 1rem",
                fontFamily: "var(--mono)",
                fontSize: "0.75rem",
                cursor: "pointer",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              ← Load Another
            </button>
            <span style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "#888" }}>
              {report.network.toUpperCase()} · {report.strategy.toUpperCase()}
            </span>
          </div>

          {/* 1 ── Transaction Flow */}
          <SectionCard title="Transaction Flow" concept="Overview">
            <Callout>
              A Bitcoin transaction works like paying with banknotes: you hand over coins (
              <strong>inputs</strong>), address the payment to the recipient (
              <strong>payment output</strong>), receive leftover change back to yourself (
              <strong>change output</strong>), and the miner who includes your transaction in a
              block keeps a small <strong>fee</strong>.
            </Callout>
            <FlowDiagram report={report} />
          </SectionCard>

          {/* 2 ── Coin Selection */}
          <SectionCard
            title={`Wallet Coins Selected — ${report.selected_inputs.length} UTXO${report.selected_inputs.length !== 1 ? "s" : ""}`}
            concept="Coin Selection"
          >
            <Callout>
              <strong>What is a UTXO?</strong> Every time you receive Bitcoin, you get a discrete
              "coin" — an Unspent Transaction Output. You can't split a coin mid-transaction, just
              like you can't tear a banknote in half. The wallet picks the smallest combination of
              coins that covers the payment <em>plus</em> the fee. Each coin type (P2WPKH, P2TR,
              etc.) has a different size on the blockchain, which affects how much fee you pay.
            </Callout>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {report.selected_inputs.map((u, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    background: "#f9f9f9",
                    border: "1px solid #e8e8e8",
                    fontFamily: "var(--mono)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: "0.7rem", color: "#888" }}>
                      Coin {i + 1} · {u.txid.slice(0, 10)}…{u.txid.slice(-6)}:{u.vout}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Pill label={u.script_type} />
                      <span style={{ fontSize: "0.7rem", color: "#777" }}>
                        script type determines transaction size
                      </span>
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "1rem", fontWeight: 700 }}>
                    {u.value_sats.toLocaleString()}{" "}
                    <span style={{ fontWeight: 400, color: "#888", fontSize: "0.75rem" }}>sats</span>
                  </div>
                </div>
              ))}
              <div
                style={{
                  textAlign: "right",
                  fontFamily: "var(--mono)",
                  fontSize: "0.8rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid #eee",
                  fontWeight: 600,
                }}
              >
                Total in: {totalIn.toLocaleString()} sats
              </div>
            </div>
          </SectionCard>

          {/* 3 ── Outputs */}
          <SectionCard title="Where the Money Goes" concept="Payments & Change">
            <Callout>
              {report.change_index !== null ? (
                <>
                  <strong>Payments</strong> go to the recipient(s). The{" "}
                  <strong style={{ color: "var(--accent)" }}>change output</strong> is the
                  leftover sent back to your own wallet — exactly like getting coins back after
                  paying with a large bill. A tiny amount goes to the miner as a{" "}
                  <strong>fee</strong> — it never appears as an output, it's simply the
                  difference between what went in and what came out.
                </>
              ) : (
                <>
                  <strong>Send All:</strong> The leftover after the payment and fee would have
                  been less than <strong>546 sats</strong> — the "dust" limit. Outputs that
                  tiny are impractical (they cost more to spend than they're worth), so the
                  wallet absorbed them into the fee instead of creating a change output.
                </>
              )}
            </Callout>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {report.outputs.map((o) => (
                <div
                  key={o.n}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    background: o.is_change ? "#fff8f0" : "#f9f9f9",
                    border: `1px solid ${o.is_change ? "var(--accent)" : "#e8e8e8"}`,
                    fontFamily: "var(--mono)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "0.7rem", color: "#999" }}>Output #{o.n}</span>
                      {o.is_change ? (
                        <Pill label="CHANGE → YOUR WALLET" bg="var(--accent)" fg="#fff" />
                      ) : (
                        <Pill label="PAYMENT → RECIPIENT" bg="#111" fg="#fff" />
                      )}
                    </div>
                    <Pill label={o.script_type} />
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "1rem", fontWeight: 700 }}>
                    {o.value_sats.toLocaleString()}{" "}
                    <span style={{ fontWeight: 400, color: "#888", fontSize: "0.75rem" }}>sats</span>
                  </div>
                </div>
              ))}

              {/* Fee row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  background: "#f4f4f4",
                  border: "1px dashed #bbb",
                  fontFamily: "var(--mono)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Pill label="FEE → MINERS" bg="#777" fg="#fff" />
                  <span style={{ fontSize: "0.68rem", color: "#999" }}>
                    not an output — mined from the difference
                  </span>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "1rem", fontWeight: 700 }}>
                  {report.fee_sats.toLocaleString()}{" "}
                  <span style={{ fontWeight: 400, color: "#888", fontSize: "0.75rem" }}>sats</span>
                </div>
              </div>

              <div
                style={{
                  textAlign: "right",
                  fontFamily: "var(--mono)",
                  fontSize: "0.8rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid #eee",
                  fontWeight: 600,
                }}
              >
                Total out:{" "}
                {report.outputs.reduce((s, o) => s + o.value_sats, 0).toLocaleString()} sats
                <span style={{ fontWeight: 400, color: "#999" }}>
                  {" "}
                  + {report.fee_sats.toLocaleString()} fee
                </span>
              </div>
            </div>
          </SectionCard>

          {/* 4 ── Fee Calculation */}
          <SectionCard title="Fee Calculation" concept="Fees">
            <Callout>
              Miners have limited space in each block. They charge per{" "}
              <strong>virtual byte (vB)</strong> — a size unit that accounts for the efficiency
              gains of modern Bitcoin transaction formats. A larger transaction (more inputs or
              outputs) uses more bytes and costs more.{" "}
              <strong>Fee&nbsp;=&nbsp;fee&nbsp;rate&nbsp;×&nbsp;size</strong>. Adding a change
              output increases the transaction size, which raises the required fee — the builder
              handles this feedback loop automatically.
            </Callout>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                flexWrap: "wrap",
                fontFamily: "var(--mono)",
              }}
            >
              {(
                [
                  { label: "Fee Rate", value: report.fee_rate_sat_vb, unit: "sat/vB" },
                  { label: "×", value: null, unit: null },
                  { label: "Size", value: report.vbytes, unit: "vB" },
                  { label: "=", value: null, unit: null },
                  { label: "Total Fee", value: report.fee_sats, unit: "sats", accent: true },
                ] as { label: string; value: number | null; unit: string | null; accent?: boolean }[]
              ).map((item, i) =>
                item.value === null ? (
                  <div key={i} style={{ fontSize: "1.75rem", color: "#bbb", padding: "0 0.25rem" }}>
                    {item.label}
                  </div>
                ) : (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "#888" }}>
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: "2rem",
                        fontWeight: 700,
                        color: item.accent ? "var(--accent)" : "#111",
                        lineHeight: 1,
                      }}
                    >
                      {item.value.toLocaleString()}
                      <span
                        style={{ fontSize: "0.8rem", fontWeight: 400, color: "#888", marginLeft: 4 }}
                      >
                        {item.unit}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </SectionCard>

          {/* 5 ── Safety Features: RBF + Locktime */}
          <SectionCard title="Safety Features" concept="RBF & Timelocks">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1.5rem",
              }}
            >
              {/* RBF */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.625rem",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Replace-By-Fee (RBF)</span>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: report.rbf_signaling ? "var(--accent)" : "#ccc",
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: report.rbf_signaling ? "var(--accent)" : "#999",
                    }}
                  >
                    {report.rbf_signaling ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#555", lineHeight: 1.7 }}>
                  If your transaction is stuck because the network is congested, RBF lets you
                  rebroadcast it with a higher fee to jump ahead in the queue. It's opt-in: you
                  signal it by setting a flag called{" "}
                  <code
                    style={{
                      fontFamily: "var(--mono)",
                      background: "#f0f0f0",
                      padding: "1px 4px",
                      fontSize: "0.8rem",
                    }}
                  >
                    nSequence ≤ 0xFFFFFFFD
                  </code>{" "}
                  on every input.
                  {report.rbf_signaling ? (
                    <strong style={{ color: "var(--accent)" }}> This transaction has RBF enabled.</strong>
                  ) : (
                    <span style={{ color: "#999" }}> Not enabled on this transaction.</span>
                  )}
                </p>
              </div>

              {/* Locktime */}
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.625rem" }}>
                  Timelock{" "}
                  <code
                    style={{
                      fontFamily: "var(--mono)",
                      fontWeight: 400,
                      fontSize: "0.8rem",
                      background: "#f0f0f0",
                      padding: "1px 4px",
                    }}
                  >
                    nLockTime
                  </code>
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "1.75rem",
                    fontWeight: 700,
                    marginBottom: 4,
                    lineHeight: 1,
                  }}
                >
                  {report.locktime.toLocaleString()}
                  {report.locktime_type !== "none" && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 400,
                        color: "#888",
                        marginLeft: 8,
                        textTransform: "uppercase",
                      }}
                    >
                      {report.locktime_type === "block_height"
                        ? "block height"
                        : "unix timestamp"}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#555", lineHeight: 1.7 }}>
                  {report.locktime_type === "none"
                    ? "No timelock — miners can include this in any block immediately."
                    : report.locktime_type === "block_height"
                    ? `Locked until block #${report.locktime.toLocaleString()}. Miners won't include this transaction until the chain reaches that block height.`
                    : `Locked until ${new Date(report.locktime * 1000).toUTCString()}. This transaction cannot be mined until that time.`}
                </p>
              </div>
            </div>
          </SectionCard>

          {/* 6 ── Warnings */}
          {report.warnings.length > 0 && (
            <SectionCard title={`Warnings — ${report.warnings.length}`}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {report.warnings.map((w, i) => {
                  const meta = WARNING_META[w.code] ?? {
                    title: w.code,
                    desc: "An unexpected condition was detected.",
                  };
                  return (
                    <div
                      key={i}
                      style={{
                        background: "#fff8f0",
                        border: "1px solid #f0a040",
                        padding: "0.875rem 1rem",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontFamily: "var(--mono)",
                          fontSize: "0.85rem",
                          marginBottom: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        ⚠ {meta.title}
                        <span
                          style={{
                            fontWeight: 400,
                            color: "#bbb",
                            fontSize: "0.7rem",
                          }}
                        >
                          [{w.code}]
                        </span>
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "#555", lineHeight: 1.65 }}>
                        {meta.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* 7 ── PSBT */}
          <SectionCard title="PSBT" concept="Partially Signed Bitcoin Transaction">
            <Callout>
              A <strong>PSBT</strong> is an unsigned transaction packaged with metadata. Think
              of it as a fully filled-out cheque that hasn't been signed yet. The metadata
              (including how much each coin is worth) lets a separate signing device verify
              everything looks correct before committing a signature. This is the{" "}
              <strong>BIP-174 standard</strong> — used by hardware wallets, multi-sig setups,
              and wallet coordination tools worldwide.
            </Callout>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "0.7rem",
                background: "#f4f4f4",
                padding: "1rem",
                wordBreak: "break-all",
                border: "1px solid #ddd",
                lineHeight: 1.9,
                color: "#333",
              }}
            >
              {report.psbt_base64}
            </div>
            <div
              style={{
                marginTop: "0.5rem",
                fontSize: "0.72rem",
                color: "#999",
                fontFamily: "var(--mono)",
              }}
            >
              Base64-encoded · starts with{" "}
              <code
                style={{ background: "#f0f0f0", padding: "1px 4px" }}
              >
                psbt\xff
              </code>{" "}
              magic bytes · ready for signing
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
