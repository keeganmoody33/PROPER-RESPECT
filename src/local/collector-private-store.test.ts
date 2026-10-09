import { chmod, link, mkdir, mkdtemp, realpath, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { openCollectorPrivateStore } from "./collector-private-store.ts";
import { CollectorService } from "./collector-service.ts";
import { CollectorCompanion, type CollectorTransport } from "./collector-companion.ts";

const roots: string[] = [];
const unavailable = async () => { throw new Error("No receiver configured."); };
const transport: CollectorTransport = { getGrant: unavailable, stageChunk: unavailable, commitReview: unavailable, deliveryStatus: unavailable };
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function privateRoot() { const root = await realpath(await mkdtemp(join(tmpdir(), "collector-private-"))); roots.push(root); return root; }

it("creates private SQLite storage and preserves committed data on reopen", async () => {
  const root = await privateRoot(), databasePath = join(root, "store", "private.sqlite");
  const database = openCollectorPrivateStore({ databasePath });
  database.exec("CREATE TABLE retained(value TEXT); INSERT INTO retained VALUES('synthetic-evidence');");
  expect(database.prepare("PRAGMA journal_mode").get()).toMatchObject({ journal_mode: "wal" });
  database.close();
  expect((await stat(join(root, "store"))).mode & 0o777).toBe(0o700);
  expect((await stat(databasePath)).mode & 0o777).toBe(0o600);
  expect((await stat(`${databasePath}-wal`)).mode & 0o777).toBe(0o600);
  expect((await stat(`${databasePath}-shm`)).mode & 0o777).toBe(0o600);
  const reopened = openCollectorPrivateStore({ databasePath });
  expect(reopened.prepare("SELECT value FROM retained").get()?.value).toBe("synthetic-evidence");
  expect(reopened.prepare("PRAGMA journal_mode").get()).toMatchObject({ journal_mode: "wal" });
  reopened.close();
});

it("both stores reject hardlinked databases before changing the original", async () => {
  const root = await privateRoot(), original = join(root, "original.sqlite"), linked = join(root, "linked.sqlite");
  const database = openCollectorPrivateStore({ databasePath: original });
  database.exec("CREATE TABLE retained(value TEXT); INSERT INTO retained VALUES('synthetic');"); database.close();
  const before = await readFile(original);
  await link(original, linked);
  expect(() => new CollectorService({ databasePath: linked })).toThrow("private");
  expect(() => new CollectorCompanion({ databasePath: linked, transport })).toThrow("private");
  expect(await readFile(original)).toEqual(before);
});

it("rejects symlinked ancestors, symlinked files, relative paths and unsafe file permissions", async () => {
  const root = await privateRoot(), privateDirectory = join(root, "private");
  await mkdir(privateDirectory, { mode: 0o700 });
  await symlink(privateDirectory, join(root, "alias"));
  expect(() => openCollectorPrivateStore({ databasePath: join(root, "alias", "database.sqlite") })).toThrow("canonical");
  const original = join(privateDirectory, "original"); await writeFile(original, "SYNTHETIC_PRIVATE", { mode: 0o600 });
  await symlink(original, join(privateDirectory, "link"));
  expect(() => openCollectorPrivateStore({ databasePath: join(privateDirectory, "link") })).toThrow();
  expect(() => openCollectorPrivateStore({ databasePath: "relative.sqlite" })).toThrow();
  await chmod(original, 0o640);
  expect(() => openCollectorPrivateStore({ databasePath: original })).toThrow();
  expect(await readFile(original, "utf8")).toBe("SYNTHETIC_PRIVATE");
});

it("rejects public directories without silently changing their permissions", async () => {
  const root = await privateRoot(), publicDirectory = join(root, "public");
  await mkdir(publicDirectory, { mode: 0o755 });
  await chmod(publicDirectory, 0o755);
  expect(() => openCollectorPrivateStore({ databasePath: join(publicDirectory, "database.sqlite") })).toThrow();
  expect((await stat(publicDirectory)).mode & 0o777).toBe(0o755);
});
