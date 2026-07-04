import { BuildError, requireField } from "./errors.js";
import { Change, Fixture, OutputScriptType, Payment, ScriptType, Utxo } from "./types.js";

const INPUT_TYPES: ScriptType[] = ["p2pkh", "p2wpkh", "p2sh-p2wpkh", "p2tr", "p2sh"];
const OUTPUT_TYPES: OutputScriptType[] = ["p2pkh", "p2wpkh", "p2tr", "p2sh"];

function isHex(value: string): boolean {
  return /^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0;
}

function asInt(value: unknown, code: string, message: string): number {
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) {
    return value;
  }
  throw new BuildError(code, message);
}

function asPositiveNumber(value: unknown, code: string, message: string): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  throw new BuildError(code, message);
}

export function validateFixture(raw: unknown): Fixture {
  requireField(raw !== null && typeof raw === "object" && !Array.isArray(raw), "INVALID_FIXTURE", "Fixture must be an object");
  const fx = raw as Fixture;

  requireField(typeof fx.network === "string" && fx.network.length > 0, "INVALID_FIXTURE", "network must be a non-empty string");
  requireField(Array.isArray(fx.utxos), "INVALID_FIXTURE", "utxos must be an array");
  requireField(Array.isArray(fx.payments) && fx.payments.length > 0, "INVALID_FIXTURE", "payments must be a non-empty array");
  requireField(typeof fx.change === "object" && fx.change !== null, "INVALID_FIXTURE", "change must be an object");

  asPositiveNumber(fx.fee_rate_sat_vb, "INVALID_FIXTURE", "fee_rate_sat_vb must be a positive number");

  fx.utxos.forEach((u: Utxo, i: number) => {
    requireField(typeof u.txid === "string" && u.txid.length === 64 && isHex(u.txid), "INVALID_FIXTURE", `utxos[${i}].txid invalid`);
    requireField(Number.isInteger(u.vout) && u.vout >= 0, "INVALID_FIXTURE", `utxos[${i}].vout invalid`);
    requireField(Number.isInteger(u.value_sats) && u.value_sats > 0, "INVALID_FIXTURE", `utxos[${i}].value_sats invalid`);
    requireField(typeof u.script_pubkey_hex === "string" && isHex(u.script_pubkey_hex), "INVALID_FIXTURE", `utxos[${i}].script_pubkey_hex invalid`);
    requireField(typeof u.script_type === "string" && INPUT_TYPES.includes(u.script_type), "UNSUPPORTED_SCRIPT", `utxos[${i}].script_type unsupported`);
    if (u.non_witness_utxo_hex !== undefined) {
      requireField(typeof u.non_witness_utxo_hex === "string" && isHex(u.non_witness_utxo_hex), "INVALID_FIXTURE", `utxos[${i}].non_witness_utxo_hex invalid`);
    }
  });

  fx.payments.forEach((p: Payment, i: number) => {
    requireField(Number.isInteger(p.value_sats) && p.value_sats > 0, "INVALID_FIXTURE", `payments[${i}].value_sats invalid`);
    requireField(typeof p.script_pubkey_hex === "string" && isHex(p.script_pubkey_hex), "INVALID_FIXTURE", `payments[${i}].script_pubkey_hex invalid`);
    requireField(typeof p.script_type === "string" && OUTPUT_TYPES.includes(p.script_type), "UNSUPPORTED_SCRIPT", `payments[${i}].script_type unsupported`);
  });

  const change = fx.change as Change;
  requireField(typeof change.script_pubkey_hex === "string" && isHex(change.script_pubkey_hex), "INVALID_FIXTURE", "change.script_pubkey_hex invalid");
  requireField(typeof change.script_type === "string" && OUTPUT_TYPES.includes(change.script_type), "UNSUPPORTED_SCRIPT", "change.script_type unsupported");

  if (fx.policy !== undefined) {
    requireField(typeof fx.policy === "object" && fx.policy !== null, "INVALID_FIXTURE", "policy must be an object");
    if (fx.policy.max_inputs !== undefined) {
      const maxInputs = asInt(fx.policy.max_inputs, "INVALID_FIXTURE", "policy.max_inputs must be integer");
      requireField(maxInputs > 0, "INVALID_FIXTURE", "policy.max_inputs must be > 0");
    }
  }

  return fx;
}
