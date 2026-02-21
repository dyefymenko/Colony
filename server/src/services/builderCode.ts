/**
 * ERC-8021 Builder Code suffix utility.
 *
 * Appends a builder attribution suffix to Base transaction calldata.
 * The suffix is parsed backwards by off-chain indexers and does not
 * affect contract execution.
 *
 * Suffix layout (appended to end of calldata):
 *   <codes_length: 1 byte>
 *   <codes: N bytes, ASCII, comma-delimited for multiple codes>
 *   <schema_id: 1 byte>  — 0x00 = canonical registry
 *   <erc_marker: 16 bytes> — 0x8021 repeated 8 times
 *
 * Register your code at https://base.dev
 * Set BASE_BUILDER_CODE env var to your registered code (e.g. "colony").
 */

// 0x8021 repeated 8 times = 16 bytes
const ERC_MARKER = Buffer.from('80218021802180218021802180218021', 'hex');
const SCHEMA_CANONICAL = Buffer.from([0x00]);

export function getBuilderCode(): string {
  return process.env.BASE_BUILDER_CODE || 'colony';
}

/**
 * Build the raw ERC-8021 suffix bytes for one or more codes.
 */
export function buildErc8021Suffix(codes: string | string[]): Buffer {
  const codesStr = Array.isArray(codes) ? codes.join(',') : codes;
  const codesBytes = Buffer.from(codesStr, 'ascii');
  const codesLength = Buffer.from([codesBytes.length]);
  return Buffer.concat([codesLength, codesBytes, SCHEMA_CANONICAL, ERC_MARKER]);
}

/**
 * Append the ERC-8021 builder code suffix to existing transaction calldata.
 * For plain ETH transfers, pass '0x' as existingData.
 *
 * @param existingData  Hex string (with or without 0x prefix)
 * @param code          Builder code to attribute (defaults to BASE_BUILDER_CODE env var)
 */
export function appendBuilderCode(existingData: string, code?: string): string {
  const base = existingData.startsWith('0x') ? existingData.slice(2) : existingData;
  const suffix = buildErc8021Suffix(code ?? getBuilderCode()).toString('hex');
  return '0x' + base + suffix;
}
