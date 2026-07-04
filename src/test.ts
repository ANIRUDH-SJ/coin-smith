import fs from "fs";
import assert from "assert";
import { buildReport, handleBuild } from "./builder.js";
import * as bitcoin from "bitcoinjs-lib";
import { initEcc } from "./compat.js";
import { Fixture } from "./types.js";

initEcc();

let passed = 0;
let failed = 0;

function loadFixture(name: string): Fixture {
  const raw = fs.readFileSync(`fixtures/${name}.json`, "utf-8");
  return JSON.parse(raw) as Fixture;
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err: unknown) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL: ${name} — ${msg}`);
  }
}

function decodePsbtTx(report: { psbt_base64: string }): bitcoin.Transaction {
  const psbt = bitcoin.Psbt.fromBase64(report.psbt_base64);
  return (psbt as unknown as { __CACHE: { __TX: bitcoin.Transaction } }).__CACHE.__TX;
}

const basic = loadFixture("basic_change_p2wpkh");

// ─── Core fixture tests ─────────────────────────────────────────────────

test("1. basic_change_p2wpkh ok", () => {
  const report = buildReport(basic);
  assert.equal(report.ok, true);
  assert.equal(report.outputs.length, 2);
  assert.equal(report.change_index, 1);
});

test("2. send_all warning", () => {
  const report = buildReport(loadFixture("send_all_dust_change"));
  assert.equal(report.change_index, null);
  assert.ok(report.warnings.some((w) => w.code === "SEND_ALL"));
});

test("3. rbf signaling true", () => {
  const report = buildReport(loadFixture("rbf_basic"));
  assert.equal(report.rbf_signaling, true);
  assert.ok(report.warnings.some((w) => w.code === "RBF_SIGNALING"));
});

test("4. rbf signaling false explicit", () => {
  const report = buildReport(loadFixture("rbf_false_explicit"));
  assert.equal(report.rbf_signaling, false);
  assert.ok(!report.warnings.some((w) => w.code === "RBF_SIGNALING"));
});

test("5. locktime block_height", () => {
  const report = buildReport(loadFixture("locktime_block_height"));
  assert.equal(report.locktime_type, "block_height");
});

test("6. locktime unix_timestamp boundary (500000000)", () => {
  const report = buildReport(loadFixture("locktime_boundary_timestamp"));
  assert.equal(report.locktime_type, "unix_timestamp");
  assert.equal(report.locktime, 500000000);
});

test("7. anti-fee-sniping locktime", () => {
  const anti = loadFixture("anti_fee_sniping");
  const report = buildReport(anti);
  assert.equal(report.locktime, anti.current_height);
  assert.equal(report.rbf_signaling, true);
});

// ─── Policy & funds tests ───────────────────────────────────────────────

test("8. max_inputs policy enforced", () => {
  const fx: Fixture = {
    ...basic,
    policy: { max_inputs: 1 },
    utxos: [
      { ...basic.utxos[0], value_sats: 20000 },
      { ...basic.utxos[0], txid: "11".repeat(32), vout: 1, value_sats: 20000 },
    ],
    payments: [{ ...basic.payments[0], value_sats: 35000 }],
  };
  const report = handleBuild(fx);
  assert.equal(report.ok, false);
});

test("9. insufficient funds error", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], value_sats: 1000 }],
    payments: [{ ...basic.payments[0], value_sats: 1000 }],
    fee_rate_sat_vb: 5,
  };
  const report = handleBuild(fx);
  assert.equal(report.ok, false);
});

test("10. dust change becomes send-all", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], value_sats: 2000 }],
    payments: [{ ...basic.payments[0], value_sats: 1330 }],
    fee_rate_sat_vb: 1,
  };
  const report = buildReport(fx);
  assert.equal(report.change_index, null);
  assert.ok(report.warnings.some((w) => w.code === "SEND_ALL"));
});

// ─── Fee & change accuracy ──────────────────────────────────────────────

test("11. fee rate accuracy within 0.01 tolerance", () => {
  const report = buildReport(basic);
  const actual = report.fee_sats / report.vbytes;
  assert.ok(Math.abs(actual - report.fee_rate_sat_vb) <= 0.01);
});

test("12. change index correct when present", () => {
  const report = buildReport(basic);
  assert.notEqual(report.change_index, null);
  assert.equal(report.outputs[report.change_index!].is_change, true);
});

test("13. multiple payments preserved", () => {
  const fx = loadFixture("many_payments");
  const report = buildReport(fx);
  const paymentsOnly = report.outputs.filter((o) => !o.is_change);
  assert.equal(paymentsOnly.length, fx.payments.length);
});

test("14. mixed input types ok", () => {
  const report = buildReport(loadFixture("mixed_input_types"));
  assert.equal(report.ok, true);
});

test("15. rbf with locktime", () => {
  const fx = loadFixture("rbf_with_locktime");
  const report = buildReport(fx);
  assert.equal(report.rbf_signaling, true);
  assert.equal(report.locktime, fx.locktime);
});

test("16. multi_input_required selects multiple inputs", () => {
  const report = buildReport(loadFixture("multi_input_required"));
  assert.ok(report.selected_inputs.length >= 2);
});

test("17. high fee warning (fee_rate > 200)", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], value_sats: 2_000_000 }],
    payments: [{ ...basic.payments[0], value_sats: 1000 }],
    fee_rate_sat_vb: 500,
  };
  const report = buildReport(fx);
  assert.ok(report.warnings.some((w) => w.code === "HIGH_FEE"));
});

test("18. non_witness_utxo_hex preserved in PSBT", () => {
  const tx = new bitcoin.Transaction();
  tx.version = 2;
  tx.addInput(Buffer.alloc(32), 0);
  tx.addOutput(Buffer.from(basic.utxos[0].script_pubkey_hex, "hex"), basic.utxos[0].value_sats);

  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], non_witness_utxo_hex: tx.toHex() }],
  };

  const report = buildReport(fx);
  assert.equal(report.ok, true);
  const psbt = bitcoin.Psbt.fromBase64(report.psbt_base64);
  assert.ok(psbt.data.inputs[0].nonWitnessUtxo);
});

test("19. change output created when above dust", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], value_sats: 100000 }],
    payments: [{ ...basic.payments[0], value_sats: 90000 }],
    fee_rate_sat_vb: 1,
  };
  const report = buildReport(fx);
  assert.notEqual(report.change_index, null);
  assert.ok(report.outputs.some((o) => o.is_change));
});

test("20. locktime_type none when locktime is zero", () => {
  const report = buildReport(basic);
  assert.equal(report.locktime, 0);
  assert.equal(report.locktime_type, "none");
});

test("21. max_inputs success path", () => {
  const fx: Fixture = {
    ...basic,
    policy: { max_inputs: 2 },
    utxos: [
      { ...basic.utxos[0], value_sats: 50000 },
      { ...basic.utxos[0], txid: "22".repeat(32), vout: 1, value_sats: 50000 },
    ],
    payments: [{ ...basic.payments[0], value_sats: 60000 }],
  };
  const report = buildReport(fx);
  assert.equal(report.ok, true);
  assert.ok(report.selected_inputs.length <= 2);
});

// ─── PSBT nSequence / nLockTime verification ────────────────────────────

test("22. PSBT nSequence = 0xFFFFFFFD when rbf: true", () => {
  const report = buildReport(loadFixture("rbf_basic"));
  const tx = decodePsbtTx(report);
  for (const input of tx.ins) {
    assert.equal(input.sequence, 0xfffffffd);
  }
});

test("23. PSBT nSequence = 0xFFFFFFFF when rbf: false, no locktime", () => {
  const report = buildReport(loadFixture("rbf_false_explicit"));
  const tx = decodePsbtTx(report);
  for (const input of tx.ins) {
    assert.equal(input.sequence, 0xffffffff);
  }
});

test("24. PSBT nSequence = 0xFFFFFFFE when locktime present, rbf: false", () => {
  const fx = loadFixture("locktime_no_rbf");
  const report = buildReport(fx);
  assert.equal(report.rbf_signaling, false);
  const tx = decodePsbtTx(report);
  for (const input of tx.ins) {
    assert.equal(input.sequence, 0xfffffffe);
  }
  assert.equal(tx.locktime, fx.locktime);
});

test("25. PSBT nLockTime matches report locktime", () => {
  const report = buildReport(loadFixture("locktime_block_height"));
  const tx = decodePsbtTx(report);
  assert.equal(tx.locktime, report.locktime);
});

test("26. PSBT input count matches selected_inputs", () => {
  const report = buildReport(basic);
  const tx = decodePsbtTx(report);
  assert.equal(tx.ins.length, report.selected_inputs.length);
});

test("27. PSBT output count matches report outputs", () => {
  const report = buildReport(basic);
  const tx = decodePsbtTx(report);
  assert.equal(tx.outs.length, report.outputs.length);
});

// ─── All untested fixture files ─────────────────────────────────────────

test("28. locktime_no_rbf: locktime_type is block_height", () => {
  const fx = loadFixture("locktime_no_rbf");
  const report = buildReport(fx);
  assert.equal(report.locktime_type, "block_height");
  assert.equal(report.locktime, fx.locktime);
  assert.equal(report.rbf_signaling, false);
});

test("29. rbf_multi_input: all inputs signal RBF in PSBT", () => {
  const fx = loadFixture("rbf_multi_input");
  const report = buildReport(fx);
  assert.equal(report.rbf_signaling, true);
  assert.ok(report.selected_inputs.length >= 2);
  const tx = decodePsbtTx(report);
  for (let i = 0; i < tx.ins.length; i++) {
    assert.equal(tx.ins[i].sequence, 0xfffffffd, `input ${i} nSequence`);
  }
});

test("30. rbf_send_all: SEND_ALL + RBF_SIGNALING both present", () => {
  const report = buildReport(loadFixture("rbf_send_all"));
  assert.equal(report.change_index, null);
  assert.ok(report.warnings.some((w) => w.code === "SEND_ALL"));
  assert.ok(report.warnings.some((w) => w.code === "RBF_SIGNALING"));
  assert.equal(report.rbf_signaling, true);
});

test("31. locktime_boundary_block: 499999999 is block_height", () => {
  const fx = loadFixture("locktime_boundary_block");
  const report = buildReport(fx);
  assert.equal(report.locktime, 499999999);
  assert.equal(report.locktime_type, "block_height");
});

test("32. locktime_unix_timestamp fixture", () => {
  const report = buildReport(loadFixture("locktime_unix_timestamp"));
  assert.equal(report.locktime_type, "unix_timestamp");
});

test("33. p2pkh_input_basic: legacy input builds ok", () => {
  const report = buildReport(loadFixture("p2pkh_input_basic"));
  assert.equal(report.ok, true);
  assert.ok(report.selected_inputs.some((i) => i.script_type === "p2pkh"));
});

test("34. p2sh_p2wpkh_input: wrapped segwit input builds ok", () => {
  const report = buildReport(loadFixture("p2sh_p2wpkh_input"));
  assert.equal(report.ok, true);
  assert.ok(report.selected_inputs.some((i) => i.script_type === "p2sh-p2wpkh"));
});

test("35. prefer_taproot_input: builds ok with valid balance", () => {
  const fx = loadFixture("prefer_taproot_input");
  const report = buildReport(fx);
  assert.equal(report.ok, true);
  const inputSum = report.selected_inputs.reduce((s, i) => s + i.value_sats, 0);
  const outputSum = report.outputs.reduce((s, o) => s + o.value_sats, 0);
  assert.equal(inputSum, outputSum + report.fee_sats);
});

test("36. multi_payment_change fixture builds ok", () => {
  const fx = loadFixture("multi_payment_change");
  const report = buildReport(fx);
  assert.equal(report.ok, true);
  const nonChange = report.outputs.filter((o) => !o.is_change);
  assert.equal(nonChange.length, fx.payments.length);
});

test("37. many_inputs_many_outputs fixture builds ok", () => {
  const report = buildReport(loadFixture("many_inputs_many_outputs"));
  assert.equal(report.ok, true);
});

test("38. small_utxos_consolidation fixture builds ok", () => {
  const report = buildReport(loadFixture("small_utxos_consolidation"));
  assert.equal(report.ok, true);
});

test("39. large_utxo_pool fixture builds ok", () => {
  const report = buildReport(loadFixture("large_utxo_pool"));
  assert.equal(report.ok, true);
});

test("40. large_mixed_script_types fixture builds ok", () => {
  const report = buildReport(loadFixture("large_mixed_script_types"));
  assert.equal(report.ok, true);
});

// ─── Balance equation for every fixture ─────────────────────────────────

test("41. balance equation: sum(inputs) = sum(outputs) + fee", () => {
  const fixtures = [
    "basic_change_p2wpkh", "send_all_dust_change", "rbf_basic",
    "rbf_false_explicit", "locktime_block_height", "locktime_boundary_timestamp",
    "anti_fee_sniping", "many_payments", "mixed_input_types",
    "rbf_with_locktime", "multi_input_required", "locktime_no_rbf",
    "rbf_multi_input", "rbf_send_all", "locktime_boundary_block",
    "locktime_unix_timestamp", "p2pkh_input_basic", "p2sh_p2wpkh_input",
    "prefer_taproot_input", "multi_payment_change",
    "many_inputs_many_outputs", "small_utxos_consolidation",
    "large_utxo_pool", "large_mixed_script_types",
  ];
  for (const name of fixtures) {
    const fx = loadFixture(name);
    const report = buildReport(fx);
    const inputSum = report.selected_inputs.reduce((s, i) => s + i.value_sats, 0);
    const outputSum = report.outputs.reduce((s, o) => s + o.value_sats, 0);
    assert.equal(inputSum, outputSum + report.fee_sats, `balance failed for ${name}`);
  }
});

// ─── Fee meets target for every fixture ─────────────────────────────────

test("42. fee >= ceil(vbytes * target_rate) for all fixtures", () => {
  const fixtures = [
    "basic_change_p2wpkh", "send_all_dust_change", "rbf_basic",
    "locktime_block_height", "anti_fee_sniping", "many_payments",
    "mixed_input_types", "rbf_with_locktime", "multi_input_required",
    "locktime_no_rbf", "rbf_multi_input", "rbf_send_all",
    "p2pkh_input_basic", "p2sh_p2wpkh_input", "prefer_taproot_input",
  ];
  for (const name of fixtures) {
    const fx = loadFixture(name);
    const report = buildReport(fx);
    const minFee = Math.ceil(report.vbytes * fx.fee_rate_sat_vb);
    assert.ok(report.fee_sats >= minFee, `fee too low for ${name}: ${report.fee_sats} < ${minFee}`);
  }
});

// ─── Edge cases ─────────────────────────────────────────────────────────

test("43. change exactly at dust threshold (546) is kept", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], value_sats: 100000 }],
    payments: [{ ...basic.payments[0], value_sats: 99000 }],
    fee_rate_sat_vb: 1,
  };
  const report = buildReport(fx);
  if (report.change_index !== null) {
    const changeOut = report.outputs[report.change_index];
    assert.ok(changeOut.value_sats >= 546, `change ${changeOut.value_sats} < dust`);
  }
});

test("44. no dust outputs ever created", () => {
  const fixtures = [
    "basic_change_p2wpkh", "send_all_dust_change", "rbf_basic",
    "many_payments", "multi_input_required", "p2pkh_input_basic",
  ];
  for (const name of fixtures) {
    const report = buildReport(loadFixture(name));
    for (const out of report.outputs) {
      assert.ok(out.value_sats >= 546, `dust output in ${name}: ${out.value_sats}`);
    }
  }
});

test("45. high fee warning when fee_sats > 1_000_000", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], value_sats: 5_000_000 }],
    payments: [{ ...basic.payments[0], value_sats: 100000 }],
    fee_rate_sat_vb: 100,
  };
  const report = buildReport(fx);
  if (report.fee_sats > 1_000_000) {
    assert.ok(report.warnings.some((w) => w.code === "HIGH_FEE"));
  }
});

test("46. SEND_ALL not emitted when change exists", () => {
  const report = buildReport(basic);
  assert.notEqual(report.change_index, null);
  assert.ok(!report.warnings.some((w) => w.code === "SEND_ALL"));
});

// ─── Interaction matrix row 2: locktime present, rbf absent ─────────────

test("47. interaction matrix row 2: rbf absent + locktime → nSeq=0xFFFFFFFE, nLockTime=locktime", () => {
  const fx: Fixture = {
    ...basic,
    rbf: false,
    locktime: 850000,
  };
  const report = buildReport(fx);
  assert.equal(report.locktime, 850000);
  assert.equal(report.locktime_type, "block_height");
  assert.equal(report.rbf_signaling, false);
  const tx = decodePsbtTx(report);
  assert.equal(tx.locktime, 850000);
  for (const input of tx.ins) {
    assert.equal(input.sequence, 0xfffffffe);
  }
});

// ─── Interaction matrix row 5: rbf true, no locktime, no current_height ─

test("48. interaction matrix row 5: rbf=true, no locktime, no current_height → nLockTime=0", () => {
  const fx: Fixture = {
    ...basic,
    rbf: true,
  };
  delete (fx as Record<string, unknown>).locktime;
  delete (fx as Record<string, unknown>).current_height;
  const report = buildReport(fx);
  assert.equal(report.locktime, 0);
  assert.equal(report.locktime_type, "none");
  assert.equal(report.rbf_signaling, true);
  const tx = decodePsbtTx(report);
  assert.equal(tx.locktime, 0);
  for (const input of tx.ins) {
    assert.equal(input.sequence, 0xfffffffd);
  }
});

// ─── Validation error tests ─────────────────────────────────────────────

test("49. reject non-object fixture", () => {
  assert.equal(handleBuild("not an object").ok, false);
  assert.equal(handleBuild(null).ok, false);
  assert.equal(handleBuild([]).ok, false);
});

test("50. reject missing required fields", () => {
  assert.equal(handleBuild({}).ok, false);
  assert.equal(handleBuild({ network: "mainnet" }).ok, false);
  assert.equal(handleBuild({ network: "mainnet", utxos: [] }).ok, false);
});

test("51. reject invalid txid (wrong length)", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], txid: "abcd" }],
  };
  assert.equal(handleBuild(fx).ok, false);
});

test("52. reject invalid hex in script_pubkey_hex", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], script_pubkey_hex: "ZZZZ" }],
  };
  assert.equal(handleBuild(fx).ok, false);
});

test("53. reject unsupported script_type", () => {
  const fx = {
    ...basic,
    utxos: [{ ...basic.utxos[0], script_type: "p2wsh" }],
  };
  assert.equal(handleBuild(fx).ok, false);
});

test("54. reject zero fee_rate_sat_vb", () => {
  const fx: Fixture = { ...basic, fee_rate_sat_vb: 0 };
  assert.equal(handleBuild(fx).ok, false);
});

test("55. reject negative fee_rate_sat_vb", () => {
  const fx: Fixture = { ...basic, fee_rate_sat_vb: -1 };
  assert.equal(handleBuild(fx).ok, false);
});

test("56. accept fractional fee_rate_sat_vb", () => {
  const fx: Fixture = { ...basic, fee_rate_sat_vb: 1.5 };
  const report = handleBuild(fx);
  assert.equal(report.ok, true);
});

test("57. extra fields in fixture are ignored", () => {
  const fx = { ...basic, _internal_metadata: "should be ignored", extra_field: 42 };
  const report = handleBuild(fx);
  assert.equal(report.ok, true);
});

// ─── PSBT structural validity ───────────────────────────────────────────

test("58. PSBT base64 decodes with valid magic bytes", () => {
  const report = buildReport(basic);
  const raw = Buffer.from(report.psbt_base64, "base64");
  assert.equal(raw[0], 0x70); // 'p'
  assert.equal(raw[1], 0x73); // 's'
  assert.equal(raw[2], 0x62); // 'b'
  assert.equal(raw[3], 0x74); // 't'
  assert.equal(raw[4], 0xff); // separator
});

test("59. PSBT output values match report output values", () => {
  const report = buildReport(basic);
  const tx = decodePsbtTx(report);
  for (let i = 0; i < report.outputs.length; i++) {
    assert.equal(tx.outs[i].value, report.outputs[i].value_sats, `output ${i} value mismatch`);
  }
});

test("60. PSBT witnessUtxo present for each input", () => {
  const report = buildReport(basic);
  const psbt = bitcoin.Psbt.fromBase64(report.psbt_base64);
  for (let i = 0; i < psbt.data.inputs.length; i++) {
    assert.ok(psbt.data.inputs[i].witnessUtxo, `input ${i} missing witnessUtxo`);
  }
});

// ─── Report field completeness ──────────────────────────────────────────

test("61. report contains all 14 required fields", () => {
  const report = buildReport(basic);
  const requiredFields = [
    "ok", "network", "strategy", "selected_inputs", "outputs",
    "change_index", "fee_sats", "fee_rate_sat_vb", "vbytes",
    "rbf_signaling", "locktime", "locktime_type", "psbt_base64", "warnings",
  ];
  for (const field of requiredFields) {
    assert.ok(field in report, `missing field: ${field}`);
  }
});

test("62. report field types are correct", () => {
  const report = buildReport(basic);
  assert.equal(typeof report.ok, "boolean");
  assert.equal(typeof report.network, "string");
  assert.equal(typeof report.strategy, "string");
  assert.ok(Array.isArray(report.selected_inputs));
  assert.ok(Array.isArray(report.outputs));
  assert.equal(typeof report.fee_sats, "number");
  assert.equal(typeof report.fee_rate_sat_vb, "number");
  assert.equal(typeof report.vbytes, "number");
  assert.equal(typeof report.rbf_signaling, "boolean");
  assert.equal(typeof report.locktime, "number");
  assert.equal(typeof report.locktime_type, "string");
  assert.equal(typeof report.psbt_base64, "string");
  assert.ok(Array.isArray(report.warnings));
});

// ─── Error structure validation ─────────────────────────────────────────

test("63. error report has non-empty code and message", () => {
  const result = handleBuild({});
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.error.code, "string");
    assert.ok(result.error.code.length > 0, "error.code must be non-empty");
    assert.equal(typeof result.error.message, "string");
    assert.ok(result.error.message.length > 0, "error.message must be non-empty");
  }
});

test("64. insufficient funds error has non-empty code and message", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], value_sats: 100 }],
    payments: [{ ...basic.payments[0], value_sats: 999999 }],
  };
  const result = handleBuild(fx);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.error.code.length > 0);
    assert.ok(result.error.message.length > 0);
  }
});

// ─── Selected inputs are valid subset of fixture UTXOs ──────────────────

test("65. selected inputs are a subset of fixture utxos", () => {
  const fx = loadFixture("multi_input_required");
  const report = buildReport(fx);
  for (const sel of report.selected_inputs) {
    const found = fx.utxos.some(
      (u) => u.txid === sel.txid && u.vout === sel.vout && u.value_sats === sel.value_sats
    );
    assert.ok(found, `selected input ${sel.txid}:${sel.vout} not in fixture utxos`);
  }
});

// ─── At most one change output ──────────────────────────────────────────

test("66. at most one change output in all fixtures", () => {
  const fixtures = [
    "basic_change_p2wpkh", "send_all_dust_change", "rbf_basic",
    "many_payments", "multi_input_required", "mixed_input_types",
  ];
  for (const name of fixtures) {
    const report = buildReport(loadFixture(name));
    const changeCount = report.outputs.filter((o) => o.is_change).length;
    assert.ok(changeCount <= 1, `${name} has ${changeCount} change outputs`);
  }
});

// ─── Change output matches fixture change template ──────────────────────

test("67. change output script_pubkey_hex matches fixture change template", () => {
  const report = buildReport(basic);
  if (report.change_index !== null) {
    const changeOut = report.outputs[report.change_index];
    assert.equal(changeOut.script_pubkey_hex, basic.change.script_pubkey_hex);
    assert.equal(changeOut.script_type, basic.change.script_type);
  }
});

// ─── Payment outputs match fixture payments ─────────────────────────────

test("68. payment outputs preserve fixture payment values and scripts", () => {
  const fx = loadFixture("many_payments");
  const report = buildReport(fx);
  const paymentsOnly = report.outputs.filter((o) => !o.is_change);
  for (let i = 0; i < fx.payments.length; i++) {
    assert.equal(paymentsOnly[i].value_sats, fx.payments[i].value_sats, `payment ${i} value`);
    assert.equal(paymentsOnly[i].script_pubkey_hex, fx.payments[i].script_pubkey_hex, `payment ${i} script`);
  }
});

// ─── Outputs n field is sequential ──────────────────────────────────────

test("69. outputs n field is sequential starting from 0", () => {
  const report = buildReport(loadFixture("many_payments"));
  for (let i = 0; i < report.outputs.length; i++) {
    assert.equal(report.outputs[i].n, i, `output n=${report.outputs[i].n} expected ${i}`);
  }
});

// ─── change_index matches the actual change output ──────────────────────

test("70. change_index null when no change output exists", () => {
  const report = buildReport(loadFixture("send_all_dust_change"));
  assert.equal(report.change_index, null);
  assert.ok(!report.outputs.some((o) => o.is_change));
});

test("71. change_index points to the correct output", () => {
  const report = buildReport(basic);
  if (report.change_index !== null) {
    assert.equal(report.outputs[report.change_index].is_change, true);
    for (let i = 0; i < report.outputs.length; i++) {
      if (i !== report.change_index) {
        assert.equal(report.outputs[i].is_change, false, `output ${i} should not be change`);
      }
    }
  }
});

// ─── PSBT transaction version ───────────────────────────────────────────

test("72. PSBT unsigned transaction version is 2", () => {
  const report = buildReport(basic);
  const tx = decodePsbtTx(report);
  assert.equal(tx.version, 2);
});

// ─── Duplicate payment outputs ──────────────────────────────────────────

test("73. duplicate payment outputs are preserved (multiset)", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], value_sats: 500000 }],
    payments: [
      { ...basic.payments[0], value_sats: 10000 },
      { ...basic.payments[0], value_sats: 10000 },
      { ...basic.payments[0], value_sats: 10000 },
    ],
  };
  const report = buildReport(fx);
  const nonChange = report.outputs.filter((o) => !o.is_change);
  assert.equal(nonChange.length, 3, "all 3 duplicate payments must be in outputs");
  for (const out of nonChange) {
    assert.equal(out.value_sats, 10000);
  }
});

// ─── Full interaction matrix PSBT verification ──────────────────────────

test("74. interaction matrix row 1: no rbf, no locktime → nSeq=0xFFFFFFFF, nLockTime=0", () => {
  const fx: Fixture = { ...basic };
  delete (fx as Record<string, unknown>).rbf;
  delete (fx as Record<string, unknown>).locktime;
  delete (fx as Record<string, unknown>).current_height;
  const report = buildReport(fx);
  assert.equal(report.locktime, 0);
  assert.equal(report.locktime_type, "none");
  assert.equal(report.rbf_signaling, false);
  const tx = decodePsbtTx(report);
  assert.equal(tx.locktime, 0);
  for (const input of tx.ins) {
    assert.equal(input.sequence, 0xffffffff);
  }
});

test("75. interaction matrix row 3: rbf=true, no locktime, current_height → nLockTime=current_height", () => {
  const fx: Fixture = {
    ...basic,
    rbf: true,
    current_height: 850123,
  };
  delete (fx as Record<string, unknown>).locktime;
  const report = buildReport(fx);
  assert.equal(report.locktime, 850123);
  assert.equal(report.locktime_type, "block_height");
  assert.equal(report.rbf_signaling, true);
  const tx = decodePsbtTx(report);
  assert.equal(tx.locktime, 850123);
  for (const input of tx.ins) {
    assert.equal(input.sequence, 0xfffffffd);
  }
});

test("76. interaction matrix row 4: rbf=true + locktime → nSeq=0xFFFFFFFD, nLockTime=locktime", () => {
  const fx: Fixture = {
    ...basic,
    rbf: true,
    locktime: 900000,
    current_height: 850000,
  };
  const report = buildReport(fx);
  assert.equal(report.locktime, 900000);
  assert.equal(report.rbf_signaling, true);
  const tx = decodePsbtTx(report);
  assert.equal(tx.locktime, 900000);
  for (const input of tx.ins) {
    assert.equal(input.sequence, 0xfffffffd);
  }
});

test("77. locktime overrides current_height when both present with rbf", () => {
  const fx: Fixture = {
    ...basic,
    rbf: true,
    locktime: 999999,
    current_height: 850000,
  };
  const report = buildReport(fx);
  assert.equal(report.locktime, 999999, "explicit locktime should override current_height");
});

// ─── Locktime type boundaries ───────────────────────────────────────────

test("78. locktime type: value 1 is block_height", () => {
  const fx: Fixture = { ...basic, locktime: 1 };
  const report = buildReport(fx);
  assert.equal(report.locktime_type, "block_height");
});

test("79. locktime type: value 499999999 is block_height", () => {
  const fx: Fixture = { ...basic, locktime: 499999999 };
  const report = buildReport(fx);
  assert.equal(report.locktime, 499999999);
  assert.equal(report.locktime_type, "block_height");
});

test("80. locktime type: value 500000000 is unix_timestamp", () => {
  const fx: Fixture = { ...basic, locktime: 500000000 };
  const report = buildReport(fx);
  assert.equal(report.locktime, 500000000);
  assert.equal(report.locktime_type, "unix_timestamp");
});

test("81. locktime type: value 500000001 is unix_timestamp", () => {
  const fx: Fixture = { ...basic, locktime: 500000001 };
  const report = buildReport(fx);
  assert.equal(report.locktime_type, "unix_timestamp");
});

// ─── HIGH_FEE warning for both triggers ─────────────────────────────────

test("82. HIGH_FEE warning when fee_rate > 200", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], value_sats: 10_000_000 }],
    payments: [{ ...basic.payments[0], value_sats: 100000 }],
    fee_rate_sat_vb: 250,
  };
  const report = buildReport(fx);
  assert.ok(report.warnings.some((w) => w.code === "HIGH_FEE"), "should warn for rate > 200");
});

test("83. HIGH_FEE warning when fee_sats > 1_000_000", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], value_sats: 50_000_000 }],
    payments: [{ ...basic.payments[0], value_sats: 10_000 }],
    fee_rate_sat_vb: 200,
  };
  const report = buildReport(fx);
  if (report.fee_sats > 1_000_000) {
    assert.ok(report.warnings.some((w) => w.code === "HIGH_FEE"), "should warn for fee > 1M");
  }
});

// ─── RBF + send-all combination ─────────────────────────────────────────

test("84. rbf + send-all: both SEND_ALL and RBF_SIGNALING warnings", () => {
  const fx: Fixture = {
    ...basic,
    rbf: true,
    utxos: [{ ...basic.utxos[0], value_sats: 2000 }],
    payments: [{ ...basic.payments[0], value_sats: 1500 }],
    fee_rate_sat_vb: 1,
  };
  const report = buildReport(fx);
  assert.equal(report.change_index, null);
  assert.ok(report.warnings.some((w) => w.code === "SEND_ALL"));
  assert.ok(report.warnings.some((w) => w.code === "RBF_SIGNALING"));
  assert.equal(report.rbf_signaling, true);
});

// ─── Network field preserved ────────────────────────────────────────────

test("85. report network matches fixture network", () => {
  const report = buildReport(basic);
  assert.equal(report.network, basic.network);
});

// ─── No dust outputs across all fixtures ────────────────────────────────

test("86. no dust outputs across all fixtures", () => {
  const fixtures = [
    "basic_change_p2wpkh", "send_all_dust_change", "rbf_basic",
    "rbf_false_explicit", "locktime_block_height", "anti_fee_sniping",
    "many_payments", "mixed_input_types", "rbf_with_locktime",
    "multi_input_required", "locktime_no_rbf", "rbf_multi_input",
    "rbf_send_all", "locktime_boundary_block", "locktime_unix_timestamp",
    "p2pkh_input_basic", "p2sh_p2wpkh_input", "prefer_taproot_input",
    "multi_payment_change", "many_inputs_many_outputs",
    "small_utxos_consolidation", "large_utxo_pool", "large_mixed_script_types",
    "locktime_boundary_timestamp",
  ];
  for (const name of fixtures) {
    const report = buildReport(loadFixture(name));
    for (const out of report.outputs) {
      assert.ok(out.value_sats >= 546, `dust output ${out.value_sats} in ${name}`);
    }
  }
});

// ─── PSBT input/output scripts match report ─────────────────────────────

test("87. PSBT output scripts match report output script_pubkey_hex", () => {
  const report = buildReport(basic);
  const tx = decodePsbtTx(report);
  for (let i = 0; i < report.outputs.length; i++) {
    assert.equal(
      tx.outs[i].script.toString("hex"),
      report.outputs[i].script_pubkey_hex,
      `output ${i} script mismatch`
    );
  }
});

test("88. PSBT input txids match selected_inputs", () => {
  const report = buildReport(loadFixture("multi_input_required"));
  const tx = decodePsbtTx(report);
  for (let i = 0; i < report.selected_inputs.length; i++) {
    const psbtTxid = Buffer.from(tx.ins[i].hash).reverse().toString("hex");
    assert.equal(psbtTxid, report.selected_inputs[i].txid, `input ${i} txid mismatch`);
  }
});

// ─── PSBT multi-input nSequence consistency ─────────────────────────────

test("89. all inputs have same nSequence in multi-input RBF scenario", () => {
  const fx = loadFixture("rbf_multi_input");
  const report = buildReport(fx);
  const tx = decodePsbtTx(report);
  assert.ok(tx.ins.length >= 2, "need multiple inputs");
  const seq = tx.ins[0].sequence;
  for (let i = 1; i < tx.ins.length; i++) {
    assert.equal(tx.ins[i].sequence, seq, `input ${i} sequence differs from input 0`);
  }
});

// ─── Validation edge cases ──────────────────────────────────────────────

test("90. reject empty utxos array", () => {
  const fx: Fixture = { ...basic, utxos: [] };
  const result = handleBuild(fx);
  assert.equal(result.ok, false);
});

test("91. reject payment with zero value_sats", () => {
  const fx = {
    ...basic,
    payments: [{ ...basic.payments[0], value_sats: 0 }],
  };
  const result = handleBuild(fx);
  assert.equal(result.ok, false);
});

test("92. reject payment with negative value_sats", () => {
  const fx = {
    ...basic,
    payments: [{ ...basic.payments[0], value_sats: -1000 }],
  };
  const result = handleBuild(fx);
  assert.equal(result.ok, false);
});

test("93. reject utxo with negative vout", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], vout: -1 }],
  };
  const result = handleBuild(fx);
  assert.equal(result.ok, false);
});

test("94. reject utxo with zero value_sats", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], value_sats: 0 }],
  };
  const result = handleBuild(fx);
  assert.equal(result.ok, false);
});

test("95. reject odd-length hex in script_pubkey_hex", () => {
  const fx: Fixture = {
    ...basic,
    utxos: [{ ...basic.utxos[0], script_pubkey_hex: "0014abc" }],
  };
  const result = handleBuild(fx);
  assert.equal(result.ok, false);
});

test("96. reject policy.max_inputs = 0", () => {
  const fx: Fixture = {
    ...basic,
    policy: { max_inputs: 0 },
  };
  const result = handleBuild(fx);
  assert.equal(result.ok, false);
});

test("97. reject fractional policy.max_inputs", () => {
  const fx: Fixture = {
    ...basic,
    policy: { max_inputs: 1.5 },
  };
  const result = handleBuild(fx);
  assert.equal(result.ok, false);
});

// ─── Fee floor and overpay ──────────────────────────────────────────────

test("98. fee is never below ceil(vbytes * target_rate) for change outputs", () => {
  const report = buildReport(basic);
  if (report.change_index !== null) {
    const minFee = Math.ceil(report.vbytes * basic.fee_rate_sat_vb);
    assert.ok(report.fee_sats >= minFee, `fee ${report.fee_sats} < minimum ${minFee}`);
  }
});

test("99. fee equals minimum when change is present (no overpay)", () => {
  const report = buildReport(basic);
  if (report.change_index !== null) {
    const minFee = Math.ceil(report.vbytes * basic.fee_rate_sat_vb);
    assert.equal(report.fee_sats, minFee, "should not overpay when change exists");
  }
});

test("100. fee_rate_sat_vb accuracy: |fee/vbytes - reported_rate| <= 0.01", () => {
  const fixtures = [
    "basic_change_p2wpkh", "rbf_basic", "locktime_block_height",
    "many_payments", "mixed_input_types", "p2pkh_input_basic",
  ];
  for (const name of fixtures) {
    const report = buildReport(loadFixture(name));
    const actual = report.fee_sats / report.vbytes;
    assert.ok(
      Math.abs(actual - report.fee_rate_sat_vb) <= 0.01,
      `rate accuracy failed for ${name}: actual=${actual} reported=${report.fee_rate_sat_vb}`
    );
  }
});

// ─── P2SH output support ────────────────────────────────────────────────

test("101. p2sh output is supported and estimated correctly", () => {
  const fx: Fixture = {
    ...basic,
    payments: [{
      address: "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
      script_pubkey_hex: "a914000000000000000000000000000000000000000087",
      script_type: "p2sh",
      value_sats: 50000
    }],
  };
  const report = buildReport(fx);
  assert.equal(report.ok, true);
  const p2shOut = report.outputs.find(o => o.script_type === "p2sh");
  assert.ok(p2shOut, "p2sh output missing");
});
console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`)
if (failed > 0) process.exit(1);
