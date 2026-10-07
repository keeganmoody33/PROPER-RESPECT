import { closeSync, constants, lstatSync, mkdirSync, openSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

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
    database.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;");
    return database;
  } catch {
    database?.close();
    throw new Error("Choose a private, owned, canonical absolute collector database location.");
  }
}
