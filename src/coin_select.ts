import { BuildError } from "./errors.js";
import { OutputScriptType, ScriptType, Utxo } from "./types.js";

export const DUST_THRESHOLD = 546;

const INPUT_VBYTES: Record<ScriptType, number> = {
  p2pkh: 148,
  p2wpkh: 68,
  "p2sh-p2wpkh": 91,
  p2tr: 58,
  p2sh: 297, // Conservative estimate for multisig or similar, though usually inputs are p2sh-p2wpkh
};

const OUTPUT_VBYTES: Record<OutputScriptType, number> = {
  p2pkh: 34,
  p2wpkh: 31,
  p2tr: 43,
  p2sh: 32,
};

const SEGWIT_INPUTS = new Set<ScriptType>(["p2wpkh", "p2sh-p2wpkh", "p2tr"]);

export function estimateVbytes(inputTypes: ScriptType[], outputTypes: OutputScriptType[]): number {
  let total = 10;
  if (inputTypes.some((t) => SEGWIT_INPUTS.has(t))) {
    total += 1;
  }
  for (const t of inputTypes) {
    total += INPUT_VBYTES[t];
  }
  for (const t of outputTypes) {
    total += OUTPUT_VBYTES[t];
  }
  return total;
}

export function feeFor(feeRate: number, vbytes: number): number {
  return Math.ceil(feeRate * vbytes);
}

export interface SelectionPlan {
  selected: Utxo[];
  vbytes: number;
  fee: number;
  change: number;
  use_change: boolean;
}

export function selectCoins(
  utxos: Utxo[],
  paymentSum: number,
  feeRate: number,
  paymentTypes: OutputScriptType[],
  changeType: OutputScriptType,
  maxInputs?: number
): SelectionPlan {
  const sorted = [...utxos].sort((a, b) => {
    if (b.value_sats !== a.value_sats) return b.value_sats - a.value_sats;
    if (a.txid !== b.txid) return a.txid.localeCompare(b.txid);
    return a.vout - b.vout;
  });

  const selected: Utxo[] = [];
  let totalIn = 0;

  for (const u of sorted) {
    if (maxInputs !== undefined && selected.length >= maxInputs) {
      break;
    }
    selected.push(u);
    totalIn += u.value_sats;

    const inputTypes = selected.map((s) => s.script_type);

    const vbytesNoChange = estimateVbytes(inputTypes, paymentTypes);
    const minFeeNoChange = feeFor(feeRate, vbytesNoChange);

    if (totalIn < paymentSum + minFeeNoChange) {
      continue;
    }

    const leftoverNoChange = totalIn - paymentSum - minFeeNoChange;
    if (leftoverNoChange < DUST_THRESHOLD) {
      return {
        selected,
        vbytes: vbytesNoChange,
        fee: totalIn - paymentSum,
        change: 0,
        use_change: false,
      };
    }

    const vbytesWithChange = estimateVbytes(inputTypes, [...paymentTypes, changeType]);
    const minFeeWithChange = feeFor(feeRate, vbytesWithChange);
    const changeValue = totalIn - paymentSum - minFeeWithChange;

    if (changeValue >= DUST_THRESHOLD) {
      return {
        selected,
        vbytes: vbytesWithChange,
        fee: minFeeWithChange,
        change: changeValue,
        use_change: true,
      };
    }

    return {
      selected,
      vbytes: vbytesNoChange,
      fee: totalIn - paymentSum,
      change: 0,
      use_change: false,
    };
  }

  throw new BuildError("INSUFFICIENT_FUNDS", "Insufficient funds to cover payments and fees");
}
