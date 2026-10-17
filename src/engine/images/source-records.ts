import type {ImageSource} from '../../shared/workspace';

type Record = {source: ImageSource; kind: string; retired: boolean; receipts: Map<string, any>; flights: Map<string, Promise<any>>; unknown: Set<string>};
/** Session-only metadata; never retain another copy of full image bytes. */
export class SourceRecords {
  private serial = 0;
  private records = new Map<string, Record>();
  register(source: ImageSource, kind: string): string {
    const token = `source_${++this.serial}`;
    this.records.set(token, {source:{...source,bytes:[]},kind,retired:false,receipts:new Map(),flights:new Map(),unknown:new Set()});
    if (this.records.size > 128) this.records.delete(this.records.keys().next().value!);
    return token;
  }
  async write<T>(record: Record, key: string, run: () => Promise<T>): Promise<T> {
    if (record.receipts.has(key)) return record.receipts.get(key);
    if (record.unknown.has(key)) throw new Error('WRITE_STATE_UNKNOWN');
    if (record.flights.has(key)) return record.flights.get(key)!;
    if (record.retired || record.receipts.size + record.unknown.size >= 64) throw new Error('STALE');
    const flight = run().then(receipt => {record.receipts.set(key, receipt);return receipt;}).catch(error => {
      if (error instanceof Error && error.message === 'WRITE_STATE_UNKNOWN') record.unknown.add(key);
      throw error;
    }).finally(() => record.flights.delete(key));
    record.flights.set(key, flight);
    return flight;
  }
  get(token: unknown, nodeId: unknown, kind: string): Record {
    const record = typeof token === 'string' ? this.records.get(token) : undefined;
    if (!record || record.source.nodeId !== nodeId || record.kind !== kind) throw new Error('STALE');
    return record;
  }
  clear(): void { this.records.clear(); }
}
