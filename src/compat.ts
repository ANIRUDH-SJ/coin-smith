import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";

let initialized = false;

export function initEcc() {
  if (!initialized) {
    bitcoin.initEccLib(ecc);
    initialized = true;
  }
}
