export type ScriptType = "p2pkh" | "p2wpkh" | "p2sh-p2wpkh" | "p2tr" | "p2sh";
export type OutputScriptType = "p2pkh" | "p2wpkh" | "p2tr" | "p2sh";

export type NetworkName = "mainnet" | "testnet" | "regtest";

export interface Utxo {
  txid: string;
  vout: number;
  value_sats: number;
  script_pubkey_hex: string;
  script_type: ScriptType;
  address?: string;
  non_witness_utxo_hex?: string;
}

export interface Payment {
  address?: string;
  script_pubkey_hex: string;
  script_type: OutputScriptType;
  value_sats: number;
}

export interface Change {
  address?: string;
  script_pubkey_hex: string;
  script_type: OutputScriptType;
}

export interface Policy {
  max_inputs?: number;
}

export interface Fixture {
  network: NetworkName;
  utxos: Utxo[];
  payments: Payment[];
  change: Change;
  fee_rate_sat_vb: number;
  rbf?: boolean;
  locktime?: number;
  current_height?: number;
  policy?: Policy;
  [key: string]: unknown;
}

export interface Warning {
  code: string;
}

export interface ReportOutput {
  n: number;
  value_sats: number;
  script_pubkey_hex: string;
  script_type: ScriptType;
  address?: string;
  is_change: boolean;
}

export interface ReportInput {
  txid: string;
  vout: number;
  value_sats: number;
  script_pubkey_hex: string;
  script_type: ScriptType;
  address?: string;
}

export interface Report {
  ok: true;
  network: NetworkName;
  strategy: string;
  selected_inputs: ReportInput[];
  outputs: ReportOutput[];
  change_index: number | null;
  fee_sats: number;
  fee_rate_sat_vb: number;
  vbytes: number;
  rbf_signaling: boolean;
  locktime: number;
  locktime_type: "none" | "block_height" | "unix_timestamp";
  psbt_base64: string;
  warnings: Warning[];
}

export interface ErrorReport {
  ok: false;
  error: { code: string; message: string };
}
