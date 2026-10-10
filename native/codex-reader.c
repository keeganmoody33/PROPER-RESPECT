/* Descriptor-relative read-only acquisition. No authentication or network APIs.
 * Output is private binary framing consumed only by the local numeric parser.
 * Do not run this program against real history without scoped approval. */
#ifdef __APPLE__
#define _DARWIN_C_SOURCE 1
#else
#define _POSIX_C_SOURCE 200809L
#define _DEFAULT_SOURCE
#endif
#include <sys/stat.h>
#include <sys/types.h>
#include <fcntl.h>
#include <dirent.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <errno.h>

#define MAX_FILES 64
#ifdef PR_STREAM_READER
#define MAX_BYTES (512 * 1024 * 1024)
#define MAX_FILE (512 * 1024 * 1024)
#else
#define MAX_BYTES (32 * 1024 * 1024)
#define MAX_FILE (4 * 1024 * 1024)
static unsigned char *contents[MAX_FILES];
static uint32_t sizes[MAX_FILES];
static unsigned lines;
#endif
static unsigned files, entries;
static unsigned seen, skip;
static int pageFull;
static size_t bytes;
static int flags = O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC;
static void word(uint32_t n);
#ifdef PR_READER_TEST_HOOKS
static void mutate(int parent, const char *name) {
  if (getenv("PR_TEST_MUTATE")) {
    int fd = openat(parent,name,O_WRONLY|O_APPEND|O_NOFOLLOW);
    if (fd < 0 || write(fd,"{}\n",3) != 3 || close(fd)) exit(2);
  }
}
#endif
static void fail(void) { fputs("Codex rollout directory could not be read safely.\n", stderr); exit(1); }
static int identity(struct stat a, struct stat b) { return a.st_dev == b.st_dev && a.st_ino == b.st_ino; }
static int same(struct stat a, struct stat b) {
#ifdef __APPLE__
  int time = a.st_mtimespec.tv_sec == b.st_mtimespec.tv_sec && a.st_mtimespec.tv_nsec == b.st_mtimespec.tv_nsec
    && a.st_ctimespec.tv_sec == b.st_ctimespec.tv_sec && a.st_ctimespec.tv_nsec == b.st_ctimespec.tv_nsec;
#else
  int time = a.st_mtim.tv_sec == b.st_mtim.tv_sec && a.st_mtim.tv_nsec == b.st_mtim.tv_nsec
    && a.st_ctim.tv_sec == b.st_ctim.tv_sec && a.st_ctim.tv_nsec == b.st_ctim.tv_nsec;
#endif
  return identity(a,b) && time && a.st_size == b.st_size && a.st_mode == b.st_mode && a.st_nlink == b.st_nlink;
}
static void file(int parent, const char *name, struct stat expected) {
  if (seen++ < skip || pageFull) return;
  if (files == MAX_FILES) { pageFull = 1; return; }
  if (files >= MAX_FILES || expected.st_nlink != 1 || expected.st_size < 0 || expected.st_size > MAX_FILE) fail();
  if (bytes + (size_t)expected.st_size > MAX_BYTES) { pageFull = 1; return; }
  bytes += (size_t)expected.st_size;
  int fd = openat(parent, name, flags);
  struct stat before, after, current;
  if (fd < 0 || fstat(fd, &before) || !S_ISREG(before.st_mode) || !same(expected,before)) fail();
#ifdef PR_STREAM_READER
  /* Bytes stay in a local pipe. The caller releases no projection until exit 0,
   * after file and ancestor checks, and discards content while streaming. */
  word((uint32_t)before.st_size);
  unsigned char buf[65536];
  size_t used = 0;
  for (;;) {
    ssize_t n = read(fd, buf, sizeof(buf));
    if (n < 0) fail();
    if (!n) break;
    used += (size_t)n;
    if (used > (size_t)before.st_size || fwrite(buf, 1, (size_t)n, stdout) != (size_t)n) fail();
  }
#else
  unsigned char *buf = malloc((size_t)before.st_size + 1);
  if (!buf) fail();
  size_t used = 0;
  for (;;) {
    ssize_t n = read(fd, buf + used, (size_t)before.st_size + 1 - used);
    if (n < 0) fail();
    if (!n) break;
    used += (size_t)n;
    if (used > (size_t)before.st_size) fail();
  }
#endif
#ifdef PR_READER_TEST_HOOKS
  mutate(parent,name);
#endif
  if (fstat(fd,&after) || fstatat(parent,name,&current,AT_SYMLINK_NOFOLLOW)
      || !same(before,after) || !same(before,current) || used != (size_t)before.st_size) fail();
  if (close(fd)) fail();
#ifdef PR_STREAM_READER
  files++;
#else
  if (used && buf[used-1] != '\n') fail();
  size_t start = 0;
  for (size_t i = 0; i < used; i++) if (buf[i] == '\n') {
    if (i-start > 256*1024 || ++lines > 100000) fail();
    start = i+1;
  }
  contents[files] = buf; sizes[files++] = (uint32_t)used;
#endif
}
static void visit(int fd, unsigned depth) {
  struct stat before, after;
  if (fstat(fd,&before) || !S_ISDIR(before.st_mode)) fail();
  int copy = dup(fd);
  DIR *dir = copy < 0 ? NULL : fdopendir(copy);
  if (!dir) fail();
  struct dirent *entry;
  for (;;) {
    errno = 0; entry = readdir(dir);
    if (!entry) { if (errno) fail(); break; }
    const char *name = entry->d_name;
    if (!strcmp(name,".") || !strcmp(name,"..")) continue;
    if (++entries > 100000) fail();
    struct stat st;
    if (fstatat(fd,name,&st,AT_SYMLINK_NOFOLLOW)) fail();
    if (S_ISDIR(st.st_mode)) {
      if (depth >= 5) fail();
      int child = openat(fd,name,flags|O_DIRECTORY);
      struct stat opened, current;
      if (child < 0 || fstat(child,&opened) || !same(st,opened)) fail();
      visit(child,depth+1);
      if (fstatat(fd,name,&current,AT_SYMLINK_NOFOLLOW) || !same(st,current) || close(child)) fail();
    } else if (S_ISREG(st.st_mode)) {
      size_t n = strlen(name);
      if (n >= 14 && !strncmp(name,"rollout-",8) && !strcmp(name+n-6,".jsonl")) file(fd,name,st);
    } else fail();
  }
  if (closedir(dir) || fstat(fd,&after) || !same(before,after)) fail();
}
static void word(uint32_t n) {
  unsigned char b[4] = {(unsigned char)(n>>24),(unsigned char)(n>>16),(unsigned char)(n>>8),(unsigned char)n};
  if (fwrite(b,1,4,stdout) != 4) fail();
}
int main(int argc, char **argv) {
  alarm(5);
  if (argc != 3 || argv[1][0] != '/' || strlen(argv[1]) > 4096) fail();
  char *end = NULL;
  unsigned long page = strtoul(argv[2],&end,10);
  if (!*argv[2] || *end || page > 100000) fail();
  skip = (unsigned)page;
  char *path = strdup(argv[1]);
  if (!path) fail();
  int chain[129], count = 1;
  char *names[128];
  chain[0] = open("/",flags|O_DIRECTORY);
  if (chain[0] < 0) fail();
  char *save = NULL;
  for (char *part = strtok_r(path,"/",&save); part; part = strtok_r(NULL,"/",&save)) {
    if (count > 128 || !strcmp(part,".") || !strcmp(part,"..")) fail();
    int child = openat(chain[count-1],part,flags|O_DIRECTORY);
    if (child < 0) fail();
    names[count-1] = part; chain[count++] = child;
  }
  visit(chain[count-1],0);
#ifdef PR_READER_TEST_HOOKS
  const char *renamed = getenv("PR_TEST_RENAME");
  if (renamed && rename(argv[1],renamed)) exit(2);
#endif
  for (int i=1;i<count;i++) {
    struct stat opened, current;
    if (fstat(chain[i],&opened) || fstatat(chain[i-1],names[i-1],&current,AT_SYMLINK_NOFOLLOW)
        || !S_ISDIR(current.st_mode) || !identity(opened,current)) fail();
  }
#ifdef PR_STREAM_READER
  word(UINT32_MAX);
  word(files);
  word(seen > skip + files ? skip + files : 0);
#else
  word(files);
  word(seen > skip + files ? skip + files : 0);
  for (unsigned i=0;i<files;i++) { word(sizes[i]); if (fwrite(contents[i],1,sizes[i],stdout) != sizes[i]) fail(); free(contents[i]); }
#endif
  if (fflush(stdout)) fail();
  for (int i=count-1;i>=0;i--) close(chain[i]);
  free(path);
  return 0;
}
