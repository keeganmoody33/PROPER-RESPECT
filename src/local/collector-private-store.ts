import { closeSync, constants, fchmodSync, fstatSync, lstatSync, mkdirSync, openSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

function tightenPrivateSidecar(path: string) {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, constants.O_RDWR | constants.O_NOFOLLOW);
    const file = fstatSync(descriptor);
    if (!file.isFile() || file.nlink !== 1 || process.getuid && file.uid !== process.getuid()) throw new Error();
    if ((file.mode & 0o777) !== 0o600) fchmodSync(descriptor, 0o600);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

/** Trusted, private local storage. Permissions are not an encryption claim. */
export function openCollectorPrivateStore({ databasePath }: { databasePath: string }): DatabaseSync {
  let database: DatabaseSync | undefined;
  try {
    if (!isAbsolute(databasePath) || resolve(databasePath) !== databasePath) throw new Error();
    const parent = dirname(databasePath);
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    const directory = lstatSync(parent);
    if (realpathSync(parent) !== parent || !directory.isDirectory() || (directory.mode & 0o077) !== 0 || process.getuid && directory.uid !== process.getuid()) throw new Error();
    try {
      const descriptor = openSync(databasePath, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      closeSync(descriptor);
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") throw error;
    }
    const file = lstatSync(databasePath);
    if (!file.isFile() || file.isSymbolicLink() || file.nlink !== 1 || (file.mode & 0o077) !== 0 || process.getuid && file.uid !== process.getuid()) throw new Error();
    database = new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });
    database.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
    const journal = database.prepare("PRAGMA journal_mode").get();
    if (!journal || typeof journal !== "object" || !("journal_mode" in journal) || journal.journal_mode !== "wal") {
      throw new Error();
    }
    tightenPrivateSidecar(`${databasePath}-wal`);
    tightenPrivateSidecar(`${databasePath}-shm`);
    return database;
  } catch {
    database?.close();
    throw new Error("Choose a private, owned, canonical absolute collector database location.");
  }
}
