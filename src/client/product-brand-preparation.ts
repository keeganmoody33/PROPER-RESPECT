// Updated 2026-09-19. Collection enrollment only; never called by card rendering.
export type BrandPreparationState = "NOT_REQUESTED" | "PENDING" | "RUNNING" | "READY" | "FAILED" | "UNVERIFIED_DOMAIN" | "PRODUCT_IDENTITY_REQUIRED";
export type BrandPreparationItem = { propId: string; status: BrandPreparationState };
const BATCH_SIZE = 25;
const MAX_WAIT_MS = 180_000;
const POLL_MS = 2_000;

function boundedOperation<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const clean = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const abort = () => { clean(); reject(new Error("Brand preparation stopped.")); };
    const timer = setTimeout(abort, 30_000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    operation.then(value => { clean(); resolve(value); }, error => { clean(); reject(error); });
  });
}

export async function prepareCollectionBrands(input: {
  propIds: string[];
  prepare: (propIds: string[]) => Promise<unknown>;
  read: (propIds: string[]) => Promise<BrandPreparationItem[]>;
  report: (items: BrandPreparationItem[], done: boolean) => void;
  signal: AbortSignal;
}) {
  const items: BrandPreparationItem[] = [...new Set(input.propIds)].map(propId => ({ propId, status: "NOT_REQUESTED" }));
  const report = (done = false) => { if (!input.signal.aborted) input.report(items.map(item => ({ ...item })), done); };
  report();
  for (let offset = 0; offset < items.length && !input.signal.aborted; offset += BATCH_SIZE) {
    const batch = items.slice(offset, offset + BATCH_SIZE);
    const ids = batch.map(item => item.propId);
    try {
      await boundedOperation(input.prepare(ids), input.signal);
      const deadline = Date.now() + MAX_WAIT_MS;
      while (!input.signal.aborted) {
        const states = new Map((await boundedOperation(input.read(ids), input.signal)).map(item => [item.propId, item.status]));
        if (input.signal.aborted) return;
        for (const item of batch) item.status = states.get(item.propId) ?? "FAILED";
        report();
        if (batch.every(item => !["PENDING", "RUNNING", "NOT_REQUESTED"].includes(item.status))) break;
        if (Date.now() >= deadline) {
          for (const item of batch) if (["PENDING", "RUNNING", "NOT_REQUESTED"].includes(item.status)) item.status = "FAILED";
          // Stop instead of adding work while earlier provider jobs may still run.
          report(true);
          return;
        }
        await new Promise<void>(resolve => {
          const finish = () => { clearTimeout(timer); input.signal.removeEventListener("abort", finish); resolve(); };
          const timer = setTimeout(finish, POLL_MS);
          input.signal.addEventListener("abort", finish, { once: true });
        });
      }
    } catch {
      for (const item of batch) item.status = "FAILED";
      report(true);
      return;
    }
  }
  report(true);
}
