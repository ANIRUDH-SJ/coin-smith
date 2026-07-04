import { BuildError } from "./errors.js";
import { selectCoins, DUST_THRESHOLD } from "./coin_select.js";
import { buildPsbtBase64, isRbfSignaling, locktimeType } from "./psbt.js";
import { validateFixture } from "./validation.js";
import { Fixture, OutputScriptType, Report, ReportInput, ReportOutput, Warning } from "./types.js";

export function buildReport(raw: unknown): Report {
  const fx = validateFixture(raw) as Fixture;

  const paymentSum = fx.payments.reduce((sum, p) => sum + p.value_sats, 0);
  const paymentTypes = fx.payments.map((p) => p.script_type) as OutputScriptType[];
  const changeType = fx.change.script_type as OutputScriptType;

  const maxInputs = fx.policy?.max_inputs;

  const plan = selectCoins(
    fx.utxos,
    paymentSum,
    fx.fee_rate_sat_vb,
    paymentTypes,
    changeType,
    maxInputs
  );

  const rbf = fx.rbf === true;
  const nLocktime = fx.locktime !== undefined
    ? fx.locktime
    : rbf && fx.current_height !== undefined
      ? fx.current_height
      : 0;

  let sequence = 0xffffffff;
  if (rbf) {
    sequence = 0xfffffffd;
  } else if (nLocktime !== 0) {
    sequence = 0xfffffffe;
  }

  const outputs: ReportOutput[] = fx.payments.map((p, idx) => ({
    n: idx,
    value_sats: p.value_sats,
    script_pubkey_hex: p.script_pubkey_hex,
    script_type: p.script_type,
    address: p.address,
    is_change: false,
  }));

  let changeIndex: number | null = null;
  if (plan.use_change) {
    changeIndex = outputs.length;
    outputs.push({
      n: changeIndex,
      value_sats: plan.change,
      script_pubkey_hex: fx.change.script_pubkey_hex,
      script_type: fx.change.script_type,
      address: fx.change.address,
      is_change: true,
    });
  }

  const psbtBase64 = buildPsbtBase64(
    fx.network,
    plan.selected,
    outputs.map((o) => ({ value_sats: o.value_sats, script_pubkey_hex: o.script_pubkey_hex })),
    sequence,
    nLocktime
  );

  const warnings: Warning[] = [];
  if (!plan.use_change) {
    warnings.push({ code: "SEND_ALL" });
  }
  if (plan.use_change && plan.change < DUST_THRESHOLD) {
    warnings.push({ code: "DUST_CHANGE" });
  }

  const feeRateActual = plan.fee / plan.vbytes;
  if (plan.fee > 1_000_000 || feeRateActual > 200) {
    warnings.push({ code: "HIGH_FEE" });
  }

  const rbfSignaling = isRbfSignaling(sequence);
  if (rbfSignaling) {
    warnings.push({ code: "RBF_SIGNALING" });
  }

  const selectedInputs: ReportInput[] = plan.selected.map((u) => ({
    txid: u.txid,
    vout: u.vout,
    value_sats: u.value_sats,
    script_pubkey_hex: u.script_pubkey_hex,
    script_type: u.script_type,
    address: u.address,
  }));

  return {
    ok: true,
    network: fx.network,
    strategy: "greedy",
    selected_inputs: selectedInputs,
    outputs,
    change_index: changeIndex,
    fee_sats: plan.fee,
    fee_rate_sat_vb: Number(feeRateActual.toFixed(2)),
    vbytes: plan.vbytes,
    rbf_signaling: rbfSignaling,
    locktime: nLocktime,
    locktime_type: locktimeType(nLocktime),
    psbt_base64: psbtBase64,
    warnings,
  };
}

export function buildError(code: string, message: string) {
  return { ok: false as const, error: { code, message } };
}

export function handleBuild(raw: unknown): Report | ReturnType<typeof buildError> {
  try {
    return buildReport(raw);
  } catch (err) {
    if (err instanceof BuildError) {
      return err.toJSON();
    }
    return buildError("INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
}
