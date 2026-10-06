# Codex native directory acquisition

This reader supplies the existing Codex numeric parser with explicitly selected
rollout files. Its C implementation uses POSIX descriptor-relative operations
on macOS and Linux. It never launches Codex, looks up a login, opens an auth
store, installs a service or contacts a provider.

The local results recorded below are Linux results. The macOS workflow must
pass on the reviewed commit before claiming tested macOS support. Signed helper
packaging, a filesystem picker and owner-approved real Mac acceptance remain
unfinished.

## Local development

Compile into a new, explicitly selected destination in an existing canonical
directory. Xcode Command Line Tools supplies `cc` on macOS. The compiler is a
development prerequisite; this command does not install it.

```sh
node scripts/build-codex-rollout-reader.mjs --output /absolute/new/reader
```

Existing output files are preserved. The script compiles the checked-in C source
with fixed warning and hardening flags and no shell. It neither discovers a
provider binary nor changes the user's Codex installation. Review and trust the
helper and its enclosing directories before giving it private-source access.
This development executable has no signing or update-integrity mechanism.

The adapter caller supplies all three inputs:

```ts
const scanned = await readCodexRolloutDirectoryNative({
  directory: approvedSourceDirectory,
  executablePath: compiledReaderPath,
  signal: collectionAbortSignal,
});
```

The return shape matches `readCodexRolloutDirectory` and contains file lines,
scanned-file count and ignored-entry count. It stays inside the local process.
The existing numeric parser must run before any persistence or upload. A caller
must check the grant before invoking the reader and again before committing its
numeric result. The directory reader itself does not create or authorize grants.

## Filesystem and privacy boundary

The native reader opens `/`, then each selected-path component with `openat`,
`O_NOFOLLOW`, `O_DIRECTORY` and nonblocking flags. It holds ancestor directory
descriptors until the read is complete. `fdopendir` enumerates a duplicate of a
pinned directory descriptor; file and descendant opens remain relative to those
descriptors. An ancestor rename cannot redirect acquisition into a replacement
tree. The original selected chain must still identify the pinned directories
before a result is accepted.

Each matching file must be regular and have one link. File size, mode, device,
inode, link count and nanosecond modification/change times must agree before and
after reading and with the current directory entry. Visited directories receive
the same consistency check. Symlinks and special entries anywhere in the selected
tree reject the entire scan. Unrelated ancestor timestamp changes are permitted.
Concurrent writers can cause a read to reject; prior retained history stays
unchanged in the calling connection.
These checks verify each file during its own read. They do not establish a
simultaneous snapshot of every file in a changing directory.

Limits match the Linux reader: five descendant directory levels, 1,000 entries,
64 rollout files, 4 MiB per file, 32 MiB total, 100,000 lines and 256 KiB per line.
Only `rollout-*.jsonl` files are selected. Missing final newlines and invalid
UTF-8 reject. Compressed files and unselected files are ignored and counted.
Referenced prefixes are not followed. The numeric parser has its own stricter
256,000-byte JSON-record limit and accounting checks.

Source files contain mixed prompts, code, instructions and tool output. Those
bytes are transiently read into local memory and pass through the private helper
pipe. The numeric parser transiently decodes them before projecting its
allowlisted metadata. They are not logged or returned as errors. They must never
reach hosted ingestion, analytics or public sharing. This is not a claim that
transcript files are never opened.

The executable receives the selected path through bounded binary stdin, so
source paths do not appear in its process arguments. It inherits no environment
variables. Its only supplied variable is the fixed `NODE_ENV=production` runtime
marker, and it runs with `/` as its working directory. The native reader prints
only a fixed diagnostic on failure. The wrapper suppresses both raw stderr and
raw IPC output on every rejected outcome. The native code has no networking or
subprocess calls; it is a trusted local reader, not an OS sandbox against a
malicious replacement executable or same-user modification of trusted code.

## Private IPC and cancellation

The request is eight bytes `PRREQ001`, a four-byte big-endian path byte length,
and at most 4,096 UTF-8 path bytes, followed by EOF. Embedded NULs, invalid UTF-8,
relative paths, dot components and trailing bytes reject.

The response is eight bytes `PRRES001`, four-byte big-endian file and ignored
counts, then one four-byte length and file-content frame per selected file.
It contains no filenames. The native process waits for acquisition and
consistency checks before writing frames. The wrapper bounds total output to
32 MiB plus framing, revalidates every frame/line, and requires a clean exit
without stderr. Truncated output, extra bytes, unknown magic or an invalid count
cannot produce an accepted result.

Both native code and wrapper measure a five-second budget with monotonic clocks.
The wrapper checks that budget again after parsing. No result is accepted after
the budget, including when timer callbacks run late. Cancellation sends TERM,
then KILL after 100 milliseconds if needed, and waits for child closure. A
1,100-millisecond cleanup barrier rejects unconfirmed termination. OS scheduling
or blocked filesystem calls cannot be promised a hard five-second return time.
The fixed helper never creates child processes.

## Verification

Run the synthetic suite against the actual compiled reader:

```sh
npx vitest run src/local/codex-rollout-native.test.ts
```

The tests compile a normal executable and a separate synthetic interleaving
executable. Interleaving hooks exist only when `PR_READER_TEST_HOOKS` is defined;
the normal build does not expose them. Real temporary files and actual pipes
exercise ancestor rename/symlink redirection, leaf replacement/mutation,
hardlinks, FIFOs, byte/line/tree limits, framing, UTF-8, cancellation, deadlines
and confirmed termination. No private history or credentials are involved.

The first run failed because the adapter module did not exist. After
implementation, all 35 boundary tests passed on Linux, including native stdin
validation and the complete helper-to-numeric-parser fixture path. This result
establishes only the tested Linux behavior.

Independent review found that Node's ASCII decoder masked high bits in the
response magic. A synthetic high-bit-header regression failed before replacing
that comparison with exact byte equality. The corrected framing rejects those
headers without returning a result.

`.github/workflows/codex-macos.yml` runs this suite on a macOS runner and retains
JUnit plus host information. A Linux pass does not establish Darwin filesystem
behavior. The workflow is prepared evidence collection; it is not a recorded
macOS pass until its exact commit run succeeds.

Real Mac acceptance must additionally approve the device, selected source,
history window and destination, then demonstrate genuine backfill, replay,
updates after restart, disconnect, retained private results and deliberate
public selection through the full connection.
