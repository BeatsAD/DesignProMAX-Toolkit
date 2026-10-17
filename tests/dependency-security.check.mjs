import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';

const sample = 'Hello Toolkit — 本地 OCR';
const validZip = Buffer.from(zipSync({ 'sample.txt': strToU8(sample) }));

// GHSA-px8p-9vwx-vf98: ZIP64 sizes without the required 0x0001 extra field.
// Run parsing in a bounded child so a dependency regression cannot hang CI.
function malformedZip64(unknownExtra) {
  const end = validZip.length - 22;
  const central = validZip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(central >= 0);
  assert.equal(validZip.readUInt32LE(end), 0x06054b50);
  assert.equal(validZip.readUInt16LE(central + 30), 0);
  assert.equal(central + 46 + validZip.readUInt16LE(central + 28), end);

  const extra = Buffer.alloc(unknownExtra ? 4 : 0);
  if (unknownExtra) {
    extra.writeUInt16LE(0xcafe, 0);
    extra.writeUInt16LE(0xffff, 2);
  }
  const prefix = Buffer.concat([validZip.subarray(0, end), extra]);
  prefix.writeUInt32LE(0xffffffff, central + 20);
  prefix.writeUInt16LE(extra.length, central + 30);

  const record = Buffer.alloc(56);
  record.writeUInt32LE(0x06064b50, 0);
  record.writeBigUInt64LE(44n, 4);
  record.writeBigUInt64LE(1n, 24);
  record.writeBigUInt64LE(1n, 32);
  record.writeBigUInt64LE(BigInt(prefix.length - central), 40);
  record.writeBigUInt64LE(BigInt(central), 48);

  const locator = Buffer.alloc(20);
  locator.writeUInt32LE(0x07064b50, 0);
  locator.writeBigUInt64LE(BigInt(prefix.length), 8);
  locator.writeUInt32LE(1, 16);

  const footer = Buffer.from(validZip.subarray(end));
  footer.writeUInt16LE(0xffff, 8);
  footer.writeUInt16LE(0xffff, 10);
  footer.writeUInt32LE(0xffffffff, 16);
  return Buffer.concat([prefix, record, locator, footer]);
}

const fixture = JSON.stringify({
  valid: validZip.toString('base64'),
  malformed: [false, true].map(value => malformedZip64(value).toString('base64')),
  sample
});
const child = `
  import assert from 'node:assert/strict';
  const { unzipSync, strFromU8, strToU8, gzipSync, gunzipSync } = await import(process.argv[1]);
  const fixture = JSON.parse(process.argv[2]);
  for (const input of fixture.malformed) {
    assert.throws(() => unzipSync(Buffer.from(input, 'base64')), error => error.code === 13);
  }
  assert.equal(strFromU8(unzipSync(Buffer.from(fixture.valid, 'base64'))['sample.txt']), fixture.sample);
  assert.equal(strFromU8(gunzipSync(gzipSync(strToU8(fixture.sample)))), fixture.sample);
`;

for (const entry of ['fflate', 'fflate/browser']) {
  test(`${entry} rejects malformed ZIP64 promptly and preserves valid ZIP/gzip`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', child, entry, fixture], {
      timeout: 3000,
      encoding: 'utf8'
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
  });
}
