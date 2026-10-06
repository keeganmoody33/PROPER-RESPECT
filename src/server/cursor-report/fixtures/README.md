These original fixtures contain synthetic values only. They exercise the Cursor
Admin report field names and the three observed dashboard CSV header layouts
verified on 2026-10-06. Identities, models, and timestamps are invented. Numeric
cases are constructed for precision and include representative counts from the
public format examples. There is no account connection or private export behind
them.

The two event pages deliberately contain identical legitimate events. Both must
survive import. Decimal JSON lexemes deliberately exceed binary floating-point
precision; preserve them exactly. Missing numeric fields and blank CSV cells
represent unknown coverage rather than zero. Included usage and reported charges
do not establish cash paid.

Official Admin schema reference:
https://cursor.com/docs/account/teams/admin-api

Maintained CSV format reference (schema review only; no upstream code copied):
https://github.com/junhoyeo/tokscale

The tests apply a UTF-8 BOM and CRLF line endings to the original v3 CSV in
memory. The checked-in text remains readable with ordinary line endings.
