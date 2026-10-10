#ifdef __APPLE__
/* Darwin's stat timespec fields require its extension namespace. */
#define _DARWIN_C_SOURCE 1
#else
#define _POSIX_C_SOURCE 200809L
#endif
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

/* Private IPC only. Never print selected paths or source bytes as diagnostics. */
enum { MAX_FILES = 64, MAX_ENTRIES = 1000, MAX_DEPTH = 5,
       MAX_FILE = 4 * 1024 * 1024, MAX_TOTAL = 32 * 1024 * 1024,
       MAX_LINES = 100000, MAX_LINE = 256 * 1024, MAX_PATH_BYTES = 4096,
       MAX_COMPONENTS = 128 };
typedef struct { unsigned char *bytes; uint32_t size; } SourceFile;
typedef struct { int parent, child; char *name; } Ancestor;
static SourceFile files[MAX_FILES];
static Ancestor ancestors[MAX_COMPONENTS];
static unsigned file_count, ignored_count, entry_count, line_count;
static size_t total_bytes;
static struct timespec started;

static int within_budget(void) {
  struct timespec now;
  if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) return 0;
  return (double)(now.tv_sec - started.tv_sec) +
    (double)(now.tv_nsec - started.tv_nsec) / 1000000000.0 < 5.0;
}
static int read_exact(int fd, void *bytes, size_t size) {
  unsigned char *out = bytes;
  while (size) {
    if (!within_budget()) return -1;
    ssize_t n = read(fd, out, size);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) return -1;
    out += (size_t)n; size -= (size_t)n;
  }
  return 0;
}
static int write_exact(int fd, const void *bytes, size_t size) {
  const unsigned char *source = bytes;
  while (size) {
    if (!within_budget()) return -1;
    ssize_t n = write(fd, source, size);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) return -1;
    source += (size_t)n; size -= (size_t)n;
  }
  return 0;
}
static uint32_t number(const unsigned char *b) {
  return (uint32_t)b[0] << 24 | (uint32_t)b[1] << 16 |
    (uint32_t)b[2] << 8 | (uint32_t)b[3];
}
static int write_number(uint32_t n) {
  unsigned char b[4] = { (unsigned char)(n >> 24), (unsigned char)(n >> 16),
    (unsigned char)(n >> 8), (unsigned char)n };
  return write_exact(STDOUT_FILENO, b, sizeof b);
}
static int valid_utf8(const unsigned char *bytes, size_t size) {
  for (size_t i = 0; i < size;) {
    uint32_t code = bytes[i++], minimum;
    unsigned following;
    if (code < 0x80) continue;
    if (code >= 0xc2 && code <= 0xdf) { following = 1; minimum = 0x80; code &= 0x1f; }
    else if (code >= 0xe0 && code <= 0xef) { following = 2; minimum = 0x800; code &= 0x0f; }
    else if (code >= 0xf0 && code <= 0xf4) { following = 3; minimum = 0x10000; code &= 0x07; }
    else return 0;
    if (size - i < following) return 0;
    while (following--) {
      unsigned char b = bytes[i++];
      if ((b & 0xc0) != 0x80) return 0;
      code = (code << 6) | (b & 0x3f);
    }
    if (code < minimum || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return 0;
  }
  return 1;
}
static int same(const struct stat *a, const struct stat *b) {
#ifdef __APPLE__
  const struct timespec am = a->st_mtimespec, bm = b->st_mtimespec;
  const struct timespec ac = a->st_ctimespec, bc = b->st_ctimespec;
#else
  const struct timespec am = a->st_mtim, bm = b->st_mtim;
  const struct timespec ac = a->st_ctim, bc = b->st_ctim;
#endif
  return a->st_dev == b->st_dev && a->st_ino == b->st_ino &&
    a->st_mode == b->st_mode && a->st_size == b->st_size &&
    a->st_nlink == b->st_nlink && am.tv_sec == bm.tv_sec && am.tv_nsec == bm.tv_nsec &&
    ac.tv_sec == bc.tv_sec && ac.tv_nsec == bc.tv_nsec;
}
/* Compile-time synthetic interleaving hooks are absent from normal builds. */
static int boundary(char phase) {
#ifdef PR_READER_TEST_HOOKS
  char ack;
  if (write_exact(3, &phase, 1) != 0 || read_exact(4, &ack, 1) != 0) return -1;
#else
  (void)phase;
#endif
  return within_budget() ? 0 : -1;
}
static int read_file(int parent, const char *name, const struct stat *expected) {
  if (file_count >= MAX_FILES || expected->st_size < 0 || expected->st_size > MAX_FILE ||
      expected->st_nlink != 1 || (size_t)expected->st_size > MAX_TOTAL - total_bytes ||
      boundary('S') != 0) return -1;
  int fd = openat(parent, name, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  if (fd < 0) return -1;
  int result = -1;
  unsigned char *bytes = NULL;
  struct stat before, after, current;
  if (fstat(fd, &before) != 0 || !S_ISREG(before.st_mode) || !same(expected, &before) ||
      boundary('F') != 0) goto done;
  size_t expected_size = (size_t)before.st_size;
  bytes = malloc(expected_size + 1);
  if (!bytes) goto done;
  size_t length = 0;
  while (length < expected_size + 1) {
    if (!within_budget()) goto done;
    size_t remaining = expected_size + 1 - length;
    ssize_t n = read(fd, bytes + length, remaining < 65536 ? remaining : 65536);
    if (n < 0 && errno == EINTR) continue;
    if (n < 0) goto done;
    if (n == 0) break;
    length += (size_t)n;
  }
  if (fstat(fd, &after) != 0 || fstatat(parent, name, &current, AT_SYMLINK_NOFOLLOW) != 0 ||
      length != expected_size || !same(&before, &after) || !same(&before, &current) ||
      (length && bytes[length - 1] != '\n') || !valid_utf8(bytes, length)) goto done;
  size_t start = 0;
  for (size_t end = 0; end < length; end++) {
    if (bytes[end] != '\n') continue;
    if (end - start > MAX_LINE || ++line_count > MAX_LINES) goto done;
    start = end + 1;
  }
  if (!within_budget()) goto done;
  files[file_count++] = (SourceFile){ bytes, (uint32_t)length };
  total_bytes += length;
  bytes = NULL;
  result = 0;
done:
  free(bytes);
  if (close(fd) != 0) result = -1;
  return result;
}
static int matching(const char *name) {
  size_t size = strlen(name);
  return size >= 14 && strncmp(name, "rollout-", 8) == 0 && strcmp(name + size - 6, ".jsonl") == 0;
}
static int visit(int fd, unsigned depth) {
  struct stat before, after;
  if (!within_budget() || fstat(fd, &before) != 0 || !S_ISDIR(before.st_mode)) return -1;
  int copy = dup(fd);
  if (copy < 0) return -1;
  DIR *entries = fdopendir(copy);
  if (!entries) { close(copy); return -1; }
  int result = -1;
  for (;;) {
    if (!within_budget()) goto done;
    errno = 0;
    struct dirent *entry = readdir(entries);
    if (!entry) { if (errno) goto done; break; }
    const char *name = entry->d_name;
    if (strcmp(name, ".") == 0 || strcmp(name, "..") == 0) continue;
    if (++entry_count > MAX_ENTRIES) goto done;
    struct stat expected, opened, current;
    if (fstatat(fd, name, &expected, AT_SYMLINK_NOFOLLOW) != 0 ||
        (!S_ISDIR(expected.st_mode) && !S_ISREG(expected.st_mode))) goto done;
    if (S_ISDIR(expected.st_mode)) {
      if (depth >= MAX_DEPTH) goto done;
      int child = openat(fd, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
      if (child < 0) goto done;
      int ok = fstat(child, &opened) == 0 && same(&expected, &opened) &&
        visit(child, depth + 1) == 0 && fstatat(fd, name, &current, AT_SYMLINK_NOFOLLOW) == 0 &&
        same(&expected, &current);
      if (close(child) != 0 || !ok) goto done;
    } else if (matching(name)) {
      if (read_file(fd, name, &expected) != 0) goto done;
    } else ignored_count++;
  }
  if (fstat(fd, &after) == 0 && same(&before, &after) && within_budget()) result = 0;
done:
  if (closedir(entries) != 0) result = -1;
  return result;
}
static int acquire(char *path) {
  if (path[0] != '/') return -1;
  int root = open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  if (root < 0) return -1;
  int fd = root, result = -1;
  unsigned ancestor_count = 0;
  char *save = NULL;
  for (char *component = strtok_r(path, "/", &save); component; component = strtok_r(NULL, "/", &save)) {
    if (ancestor_count >= MAX_COMPONENTS || strcmp(component, ".") == 0 || strcmp(component, "..") == 0 || !within_budget()) goto done;
    int child = openat(fd, component, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
    if (child < 0) goto done;
    ancestors[ancestor_count++] = (Ancestor){ fd, child, component };
    fd = child;
  }
  if (boundary('D') != 0 || visit(fd, 0) != 0) goto done;
  for (unsigned i = 0; i < ancestor_count; i++) {
    struct stat current, opened;
    Ancestor entry = ancestors[i];
    if (!within_budget() || fstatat(entry.parent, entry.name, &current, AT_SYMLINK_NOFOLLOW) != 0 ||
        fstat(entry.child, &opened) != 0 || !S_ISDIR(current.st_mode) ||
        current.st_dev != opened.st_dev || current.st_ino != opened.st_ino) goto done;
  }
  result = within_budget() ? 0 : -1;
done:
  for (unsigned i = ancestor_count; i > 0; i--) if (close(ancestors[i - 1].child) != 0) result = -1;
  if (close(root) != 0) result = -1;
  return result;
}
int main(int argc, char **argv) {
  (void)argv;
  int status = 1;
  unsigned char header[12], extra;
  char path[MAX_PATH_BYTES + 1];
  if (clock_gettime(CLOCK_MONOTONIC, &started) != 0 || argc != 1 ||
      read_exact(STDIN_FILENO, header, sizeof header) != 0 || memcmp(header, "PRREQ001", 8) != 0) goto done;
  uint32_t size = number(header + 8);
  if (!size || size > MAX_PATH_BYTES || read_exact(STDIN_FILENO, path, size) != 0 ||
      memchr(path, 0, size) || !valid_utf8((const unsigned char *)path, size)) goto done;
  path[size] = 0;
  ssize_t trailing;
  do { trailing = read(STDIN_FILENO, &extra, 1); } while (trailing < 0 && errno == EINTR && within_budget());
  if (trailing != 0 || !within_budget() || acquire(path) != 0) goto done;
  if (write_exact(STDOUT_FILENO, "PRRES001", 8) != 0 || write_number(file_count) != 0 ||
      write_number(ignored_count) != 0) goto done;
  for (unsigned i = 0; i < file_count; i++) {
    if (write_number(files[i].size) != 0 || write_exact(STDOUT_FILENO, files[i].bytes, files[i].size) != 0) goto done;
  }
  status = 0;
done:
  for (unsigned i = 0; i < file_count; i++) free(files[i].bytes);
  if (status) {
    const char message[] = "Codex rollout acquisition failed.\n";
    /* Fixed stderr does not contain errno, filenames, source records or credentials. */
    if (write(STDERR_FILENO, message, sizeof message - 1) < 0) status = 1;
  }
  return status;
}
