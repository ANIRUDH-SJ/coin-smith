# Coin Smith

A **safe Bitcoin PSBT transaction builder**. Given a set of UTXOs, one or more payment outputs,
a change template, and a target fee rate, it selects coins, constructs an unsigned transaction,
and exports a standards-compliant **PSBT (BIP-174)** — along with a machine-checkable JSON report
and a web UI that visualizes and justifies the result.

It's built as a wallet-engineering exercise: protocol-first correctness, defensive validation of
messy inputs, and sensible fee/change optimization rather than a single hard-coded strategy.

## Features

- **Coin selection** — chooses which UTXOs to spend to fund the requested payments, optimizing a
  multi-objective cost model (fees paid, input count, and other wallet-quality signals) instead of
  a naïve first-fit.
- **Unsigned transaction construction** — assembles inputs, payment outputs, and change, with
  correct fee and change accounting across edge cases (dust change, insufficient funds, exact-fit).
- **PSBT export (BIP-174)** — emits a valid PSBT containing the unsigned transaction and the
  prevout information a signer needs.
- **Multi-script support** — handles common output types (P2WPKH, P2SH, P2WSH, …) when estimating
  sizes and building outputs.
- **Defensive validation** — rejects malformed fixtures, inconsistent amounts, and impossible
  fee/change combinations with structured error codes rather than crashing.
- **Web visualizer** — a React UI that renders the selected inputs, outputs, fee, and change with
  plain-language explanations of *why* the transaction was built that way.

## Tech stack

TypeScript · Node.js · Express · React · `bitcoinjs-lib` · `tiny-secp256k1` · esbuild

## Architecture

```
src/
  coin_select.ts  # UTXO selection + multi-objective cost model
  builder.ts      # unsigned transaction assembly, fee/change logic
  psbt.ts         # PSBT (BIP-174) construction and serialization
  validation.ts   # input validation + structured error handling
  errors.ts       # error codes
  types.ts        # shared domain types
  cli.ts          # CLI entrypoint
  server.ts       # Express API backing the web UI
  web/index.tsx   # React web UI (bundled to web/bundle.js by esbuild)
build-web.js      # esbuild bundling for the web UI
```

## Usage

```bash
./setup.sh                 # install deps, compile TS, bundle the web UI

# Build a transaction from an input fixture -> writes out/<name>.json
./cli.sh <input.json>

# Web UI (defaults to http://127.0.0.1:3000, honors $PORT)
./web.sh
```

Input is a JSON object describing the available UTXOs, the payment output(s), a change template,
and a target fee rate; the tool returns the selected inputs, the constructed PSBT, and a report
explaining the result.

## Notes

The builder produces **unsigned** transactions — signing and broadcast are intentionally out of
scope. The focus is correct construction, safe validation, and transparent coin-selection
decisions.
