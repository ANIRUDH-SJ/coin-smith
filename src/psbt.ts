import * as bitcoin from "bitcoinjs-lib";
import { initEcc } from "./compat.js";
import { ScriptType, Utxo } from "./types.js";

const NETWORKS: Record<string, bitcoin.Network> = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  regtest: bitcoin.networks.regtest,
};

export function networkFromName(name: string): bitcoin.Network {
  return NETWORKS[name] ?? bitcoin.networks.bitcoin;
}

export function buildPsbtBase64(
  networkName: string,
  inputs: Utxo[],
  outputs: { value_sats: number; script_pubkey_hex: string }[],
  sequence: number,
  locktime: number
): string {
  initEcc();
  const network = networkFromName(networkName);
  const psbt = new bitcoin.Psbt({ network });
  psbt.setVersion(2);
  psbt.setLocktime(locktime);

  for (const input of inputs) {
    const inputData: {
      hash: string;
      index: number;
      sequence: number;
      witnessUtxo: { script: Buffer; value: number };
      nonWitnessUtxo?: Buffer;
    } = {
      hash: input.txid,
      index: input.vout,
      sequence,
      witnessUtxo: {
        script: Buffer.from(input.script_pubkey_hex, "hex"),
        value: input.value_sats,
      },
    };
    if (input.non_witness_utxo_hex) {
      inputData.nonWitnessUtxo = Buffer.from(input.non_witness_utxo_hex, "hex");
    }
    psbt.addInput(inputData);
  }

  for (const out of outputs) {
    psbt.addOutput({
      script: Buffer.from(out.script_pubkey_hex, "hex"),
      value: out.value_sats,
    });
  }

  return psbt.toBase64();
}

export function locktimeType(locktime: number): "none" | "block_height" | "unix_timestamp" {
  if (locktime === 0) return "none";
  if (locktime < 500_000_000) return "block_height";
  return "unix_timestamp";
}

export function isRbfSignaling(sequence: number): boolean {
  return sequence <= 0xfffffffd;
}

export const OutputTypes: ScriptType[] = ["p2pkh", "p2wpkh", "p2tr", "p2sh"];
