#define _POSIX_C_SOURCE 200809L
#define _DARWIN_C_SOURCE
#include <sys/stat.h>
#include <fcntl.h>
#include <stdio.h>
#include <unistd.h>
/* OS-owned lock releases on EOF, crash, restart or signal. The file is empty. */
int main(int argc, char **argv) {
  if (argc != 2) return 1;
  int fd = open(argv[1],O_RDWR|O_CREAT|O_NOFOLLOW|O_CLOEXEC,0600);
  struct stat st;
  if (fd < 0 || fstat(fd,&st) || !S_ISREG(st.st_mode) || st.st_nlink != 1 || st.st_uid != getuid() || (st.st_mode & 077) != 0) return 1;
  struct flock lock = {0}; lock.l_type = F_WRLCK; lock.l_whence = SEEK_SET;
  if (fcntl(fd,F_SETLK,&lock)) return 1;
  if (putchar('1') == EOF || fflush(stdout)) return 1;
  char byte;
  while (read(STDIN_FILENO,&byte,1) > 0) {}
  close(fd); return 0;
}
