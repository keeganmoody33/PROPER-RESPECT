# Brand fidelity, before

Card commit: `2ba6aa8e6c9c761d0fc0a017c4e6b8881aa8d8cb`. Tolerances: colour OKLab distance <= 0.05; radius within 2px or the same class (square <= 1px, slightly rounded <= 8px, pill >= half the height, else rounded); family the same named family, else the same generic class; letter-spacing within 0.03em.

| Brand | Passed | Failed | Untested |
| --- | --- | --- | --- |
| Clay | 10 | 4 | 2 |
| Cloudflare | 9 | 2 | 5 |
| Context.dev | 11 | 4 | 1 |
| Docker | 12 | 3 | 1 |
| Elicit | 8 | 3 | 5 |
| Exa | 13 | 3 | 0 |
| Firecrawl | 11 | 5 | 0 |
| GitHub | 12 | 3 | 1 |
| n8n | 12 | 4 | 0 |
| Open Places | 13 | 3 | 0 |
| Porkbun | 0 | 0 | 16 |
| Spider | 10 | 6 | 0 |

Totals: 121 passed, 40 failed, 31 untested.

| # | Target | Site | Card | Result |
| --- | --- | --- | --- | --- |
| 1 | Clay: the card's surface is the site's page background | #ffffff | #ffffff | passed |
| 2 | Clay: the card's text colour is the site's body text colour | untested: no 20+ characters of plain text straight on the page background | #000000 | untested: site: no 20+ characters of plain text straight on the page background |
| 3 | Clay: the card's heading is set in the site's h1 family | Roobertvf (sans-serif) | Roobertvf (sans-serif) | passed |
| 4 | Clay: the card's body text is set in the site's paragraph family | Roobertvf (sans-serif) | Roobertvf (sans-serif) | passed |
| 5 | Clay: the card's button fill is the site's primary call-to-action fill | #cbd810 | #000000 | failed: OKLab distance 0.864 > 0.05 |
| 6 | Clay: the card's button label colour is the site's primary call-to-action label colour | #000000 | #ffffff | failed: OKLab distance 1.000 > 0.05 |
| 7 | Clay: the card's button corners match the site's primary call-to-action within 2px or in class | 12px rounded | 12px rounded | passed |
| 8 | Clay: the card's button label is set in the site's call-to-action family | Roobertvf (sans-serif) | Roobertvf (sans-serif) | passed |
| 9 | Clay: the card's button label has the site's call-to-action case | as written | uppercase | failed: as written vs uppercase |
| 10 | Clay: the card's button label has the site's call-to-action letter-spacing | -0.010em | 0.000em | passed |
| 11 | Clay: the card's chart bars are the site's accent | #cbd810 (primary call-to-action fill) | untested: no chart | untested: card: no chart |
| 12 | Clay: the card's corners match the site's bordered panels within 2px or in class | 48px rounded | 18px rounded | passed |
| 13 | Clay: the card's chips match the site's button corners within 2px or in class | 12px rounded | 12px pill | passed |
| 14 | Clay: the card's small labels are monospace exactly when the site's are | false | false | passed |
| 15 | Clay: the card's small labels have the site's small-label case | as written | uppercase | failed: as written vs uppercase |
| 16 | Clay: the card's small labels have the site's small-label letter-spacing | 0.000em | 0.000em | passed |
| 17 | Cloudflare: the card's surface is the site's page background | #ffffff | #ffffff | passed |
| 18 | Cloudflare: the card's text colour is the site's body text colour | untested: no 20+ characters of plain text straight on the page background | #262626 | untested: site: no 20+ characters of plain text straight on the page background |
| 19 | Cloudflare: the card's heading is set in the site's h1 family | STK Bureau Sans (sans-serif) | STK Bureau Sans (sans-serif) | passed |
| 20 | Cloudflare: the card's body text is set in the site's paragraph family | STK Bureau Sans (sans-serif) | STK Bureau Sans (sans-serif) | passed |
| 21 | Cloudflare: the card's button fill is the site's primary call-to-action fill | #ffffff | #ff5e1f | failed: OKLab distance 0.376 > 0.05 |
| 22 | Cloudflare: the card's button label colour is the site's primary call-to-action label colour | #1f1f1f | #262626 | passed |
| 23 | Cloudflare: the card's button corners match the site's primary call-to-action within 2px or in class | 50px pill | 44px pill | passed |
| 24 | Cloudflare: the card's button label is set in the site's call-to-action family | STK Bureau Sans (sans-serif) | STK Bureau Sans (sans-serif) | passed |
| 25 | Cloudflare: the card's button label has the site's call-to-action case | as written | uppercase | failed: as written vs uppercase |
| 26 | Cloudflare: the card's button label has the site's call-to-action letter-spacing | 0.000em | -0.025em | passed |
| 27 | Cloudflare: the card's chart bars are the site's accent | #ff5f08 (logo (inline svg in header)) | #ff5e1f | passed |
| 28 | Cloudflare: the card's corners match the site's bordered panels within 2px or in class | untested: no bordered or filled box in the first viewport | 4px slightly rounded | untested: site: no bordered or filled box in the first viewport |
| 29 | Cloudflare: the card's chips match the site's button corners within 2px or in class | 50px pill | 25px pill | passed |
| 30 | Cloudflare: the card's small labels are monospace exactly when the site's are | untested: no small labels in the first viewport | false | untested: site: no small labels in the first viewport |
| 31 | Cloudflare: the card's small labels have the site's small-label case | untested: no small labels in the first viewport | uppercase | untested: site: no small labels in the first viewport |
| 32 | Cloudflare: the card's small labels have the site's small-label letter-spacing | untested: no small labels in the first viewport | -0.025em | untested: site: no small labels in the first viewport |
| 33 | Context.dev: the card's surface is the site's page background | #ffffff | #ffffff | passed |
| 34 | Context.dev: the card's text colour is the site's body text colour | #000000 | #000000 | passed |
| 35 | Context.dev: the card's heading is set in the site's h1 family | rethinkSans (sans-serif) | rethinkSans (sans-serif) | passed |
| 36 | Context.dev: the card's body text is set in the site's paragraph family | untested: no visible body text outside header/nav | rethinkSans (sans-serif) | untested: site: no visible body text outside header/nav |
| 37 | Context.dev: the card's button fill is the site's primary call-to-action fill | #000000 | #2563eb | failed: OKLab distance 0.587 > 0.05 |
| 38 | Context.dev: the card's button label colour is the site's primary call-to-action label colour | #ffffff | #ffffff | passed |
| 39 | Context.dev: the card's button corners match the site's primary call-to-action within 2px or in class | 42.31px pill | 44px pill | passed |
| 40 | Context.dev: the card's button label is set in the site's call-to-action family | rethinkSans (sans-serif) | rethinkSans (sans-serif) | passed |
| 41 | Context.dev: the card's button label has the site's call-to-action case | as written | uppercase | failed: as written vs uppercase |
| 42 | Context.dev: the card's button label has the site's call-to-action letter-spacing | 0.000em | 0.000em | passed |
| 43 | Context.dev: the card's chart bars are the site's accent | #2563eb (link text) | #2563eb | passed |
| 44 | Context.dev: the card's corners match the site's bordered panels within 2px or in class | 25.2px rounded | 7.2px slightly rounded | failed: rounded vs slightly rounded |
| 45 | Context.dev: the card's chips match the site's button corners within 2px or in class | 42.31px pill | 25px pill | passed |
| 46 | Context.dev: the card's small labels are monospace exactly when the site's are | false | false | passed |
| 47 | Context.dev: the card's small labels have the site's small-label case | as written | uppercase | failed: as written vs uppercase |
| 48 | Context.dev: the card's small labels have the site's small-label letter-spacing | 0.000em | 0.000em | passed |
| 49 | Docker: the card's surface is the site's page background | #f9fafb | #f9fafb | passed |
| 50 | Docker: the card's text colour is the site's body text colour | untested: no 20+ characters of plain text straight on the page background | #2c333f | untested: site: no 20+ characters of plain text straight on the page background |
| 51 | Docker: the card's heading is set in the site's h1 family | Repro (sans-serif) | Repro (sans-serif) | passed |
| 52 | Docker: the card's body text is set in the site's paragraph family | Inter (sans-serif) | Inter (sans-serif) | passed |
| 53 | Docker: the card's button fill is the site's primary call-to-action fill | #2560ff | #2560ff | passed |
| 54 | Docker: the card's button label colour is the site's primary call-to-action label colour | #ffffff | #ffffff | passed |
| 55 | Docker: the card's button corners match the site's primary call-to-action within 2px or in class | 8px slightly rounded | 8px slightly rounded | passed |
| 56 | Docker: the card's button label is set in the site's call-to-action family | Inter (sans-serif) | Inter (sans-serif) | passed |
| 57 | Docker: the card's button label has the site's call-to-action case | as written | uppercase | failed: as written vs uppercase |
| 58 | Docker: the card's button label has the site's call-to-action letter-spacing | -0.011em | -0.014em | passed |
| 59 | Docker: the card's chart bars are the site's accent | #2560ff (primary call-to-action fill) | #2560ff | passed |
| 60 | Docker: the card's corners match the site's bordered panels within 2px or in class | 0px square | 18px rounded | failed: square vs rounded |
| 61 | Docker: the card's chips match the site's button corners within 2px or in class | 8px slightly rounded | 8px slightly rounded | passed |
| 62 | Docker: the card's small labels are monospace exactly when the site's are | false | false | passed |
| 63 | Docker: the card's small labels have the site's small-label case | as written | uppercase | failed: as written vs uppercase |
| 64 | Docker: the card's small labels have the site's small-label letter-spacing | -0.011em | -0.014em | passed |
| 65 | Elicit: the card's surface is the site's page background | #fcfcf8 | #fcfcf8 | passed |
| 66 | Elicit: the card's text colour is the site's body text colour | untested: no 20+ characters of plain text straight on the page background | #000000 | untested: site: no 20+ characters of plain text straight on the page background |
| 67 | Elicit: the card's heading is set in the site's h1 family | Martina Plantijn Regular (sans-serif) | Martina Plantijn Regular (sans-serif) | passed |
| 68 | Elicit: the card's body text is set in the site's paragraph family | Special Gothic Variable (sans-serif) | Special Gothic Variable (sans-serif) | passed |
| 69 | Elicit: the card's button fill is the site's primary call-to-action fill | #026370 | #083d44 | failed: OKLab distance 0.130 > 0.05 |
| 70 | Elicit: the card's button label colour is the site's primary call-to-action label colour | #fcfcf8 | #ffffff | passed |
| 71 | Elicit: the card's button corners match the site's primary call-to-action within 2px or in class | 8px slightly rounded | 8px slightly rounded | passed |
| 72 | Elicit: the card's button label is set in the site's call-to-action family | Special Gothic Variable (sans-serif) | Special Gothic Variable (sans-serif) | passed |
| 73 | Elicit: the card's button label has the site's call-to-action case | as written | uppercase | failed: as written vs uppercase |
| 74 | Elicit: the card's button label has the site's call-to-action letter-spacing | 0.009em | 0.009em | passed |
| 75 | Elicit: the card's chart bars are the site's accent | #026370 (primary call-to-action fill) | #083d44 | failed: OKLab distance 0.130 > 0.05 |
| 76 | Elicit: the card's corners match the site's bordered panels within 2px or in class | untested: no bordered or filled box in the first viewport | 8px slightly rounded | untested: site: no bordered or filled box in the first viewport |
| 77 | Elicit: the card's chips match the site's button corners within 2px or in class | 8px slightly rounded | 8px slightly rounded | passed |
| 78 | Elicit: the card's small labels are monospace exactly when the site's are | untested: no small labels in the first viewport | false | untested: site: no small labels in the first viewport |
| 79 | Elicit: the card's small labels have the site's small-label case | untested: no small labels in the first viewport | uppercase | untested: site: no small labels in the first viewport |
| 80 | Elicit: the card's small labels have the site's small-label letter-spacing | untested: no small labels in the first viewport | 0.009em | untested: site: no small labels in the first viewport |
| 81 | Exa: the card's surface is the site's page background | #ffffff | #ffffff | passed |
| 82 | Exa: the card's text colour is the site's body text colour | #111827 | #000000 | failed: OKLab distance 0.212 > 0.05 |
| 83 | Exa: the card's heading is set in the site's h1 family | Arizona (serif) | Arizona (serif) | passed |
| 84 | Exa: the card's body text is set in the site's paragraph family | ABCDiatype (sans-serif) | ABCDiatype (sans-serif) | passed |
| 85 | Exa: the card's button fill is the site's primary call-to-action fill | #000000 | #000000 | passed |
| 86 | Exa: the card's button label colour is the site's primary call-to-action label colour | #ffffff | #ffffff | passed |
| 87 | Exa: the card's button corners match the site's primary call-to-action within 2px or in class | 4px slightly rounded | 4px slightly rounded | passed |
| 88 | Exa: the card's button label is set in the site's call-to-action family | ABCDiatype (sans-serif) | ABCDiatype (sans-serif) | passed |
| 89 | Exa: the card's button label has the site's call-to-action case | as written | uppercase | failed: as written vs uppercase |
| 90 | Exa: the card's button label has the site's call-to-action letter-spacing | -0.020em | -0.020em | passed |
| 91 | Exa: the card's chart bars are the site's accent | #1f40ed (link text) | #1f40ed | passed |
| 92 | Exa: the card's corners match the site's bordered panels within 2px or in class | 6px slightly rounded | 4px slightly rounded | passed |
| 93 | Exa: the card's chips match the site's button corners within 2px or in class | 4px slightly rounded | 4px slightly rounded | passed |
| 94 | Exa: the card's small labels are monospace exactly when the site's are | false | false | passed |
| 95 | Exa: the card's small labels have the site's small-label case | as written | uppercase | failed: as written vs uppercase |
| 96 | Exa: the card's small labels have the site's small-label letter-spacing | -0.020em | -0.020em | passed |
| 97 | Firecrawl: the card's surface is the site's page background | #f9f9f9 | #f9f9f9 | passed |
| 98 | Firecrawl: the card's text colour is the site's body text colour | #262626 | #262626 | passed |
| 99 | Firecrawl: the card's heading is set in the site's h1 family | suisse (sans-serif) | suisse (sans-serif) | passed |
| 100 | Firecrawl: the card's body text is set in the site's paragraph family | suisse (sans-serif) | suisse (sans-serif) | passed |
| 101 | Firecrawl: the card's button fill is the site's primary call-to-action fill | #ff4c00 | #ff4c00 | passed |
| 102 | Firecrawl: the card's button label colour is the site's primary call-to-action label colour | #ffffff | #262626 | failed: OKLab distance 0.731 > 0.05 |
| 103 | Firecrawl: the card's button corners match the site's primary call-to-action within 2px or in class | 10px rounded | 20px rounded | passed |
| 104 | Firecrawl: the card's button label is set in the site's call-to-action family | suisse (sans-serif) | suisse (sans-serif) | passed |
| 105 | Firecrawl: the card's button label has the site's call-to-action case | as written | uppercase | failed: as written vs uppercase |
| 106 | Firecrawl: the card's button label has the site's call-to-action letter-spacing | 0.000em | 0.000em | passed |
| 107 | Firecrawl: the card's chart bars are the site's accent | #ff4c00 (primary call-to-action fill) | #ff4c00 | passed |
| 108 | Firecrawl: the card's corners match the site's bordered panels within 2px or in class | 20px rounded | 8px slightly rounded | failed: rounded vs slightly rounded |
| 109 | Firecrawl: the card's chips match the site's button corners within 2px or in class | 10px rounded | 20px pill | failed: rounded vs pill |
| 110 | Firecrawl: the card's small labels are monospace exactly when the site's are | false | false | passed |
| 111 | Firecrawl: the card's small labels have the site's small-label case | as written | uppercase | failed: as written vs uppercase |
| 112 | Firecrawl: the card's small labels have the site's small-label letter-spacing | 0.000em | 0.000em | passed |
| 113 | GitHub: the card's surface is the site's page background | #ffffff | #ffffff | passed |
| 114 | GitHub: the card's text colour is the site's body text colour | #000000 | #000000 | passed |
| 115 | GitHub: the card's heading is set in the site's h1 family | Mona Sans (sans-serif) | Mona Sans (sans-serif) | passed |
| 116 | GitHub: the card's body text is set in the site's paragraph family | untested: no visible body text outside header/nav | Mona Sans (sans-serif) | untested: site: no visible body text outside header/nav |
| 117 | GitHub: the card's button fill is the site's primary call-to-action fill | #08872b | #08872b | passed |
| 118 | GitHub: the card's button label colour is the site's primary call-to-action label colour | #ffffff | #ffffff | passed |
| 119 | GitHub: the card's button corners match the site's primary call-to-action within 2px or in class | 6px slightly rounded | 6px slightly rounded | passed |
| 120 | GitHub: the card's button label is set in the site's call-to-action family | Mona Sans (sans-serif) | Mona Sans (sans-serif) | passed |
| 121 | GitHub: the card's button label has the site's call-to-action case | as written | uppercase | failed: as written vs uppercase |
| 122 | GitHub: the card's button label has the site's call-to-action letter-spacing | 0.010em | 0.011em | passed |
| 123 | GitHub: the card's chart bars are the site's accent | #0969da (link text) | #216e39 | failed: OKLab distance 0.256 > 0.05 |
| 124 | GitHub: the card's corners match the site's bordered panels within 2px or in class | 8px slightly rounded | 8px slightly rounded | passed |
| 125 | GitHub: the card's chips match the site's button corners within 2px or in class | 6px slightly rounded | 6px slightly rounded | passed |
| 126 | GitHub: the card's small labels are monospace exactly when the site's are | false | false | passed |
| 127 | GitHub: the card's small labels have the site's small-label case | as written | uppercase | failed: as written vs uppercase |
| 128 | GitHub: the card's small labels have the site's small-label letter-spacing | 0.015em | 0.011em | passed |
| 129 | n8n: the card's surface is the site's page background | #fafafa | #fafafa | passed |
| 130 | n8n: the card's text colour is the site's body text colour | #161616 | #161616 | passed |
| 131 | n8n: the card's heading is set in the site's h1 family | n8n Baumer Uniwidth (sans-serif) | n8n Baumer Uniwidth (sans-serif) | passed |
| 132 | n8n: the card's body text is set in the site's paragraph family | n8n Baumer Uniwidth (sans-serif) | n8n Baumer Uniwidth (sans-serif) | passed |
| 133 | n8n: the card's button fill is the site's primary call-to-action fill | #ffbcca | #ffbcca | passed |
| 134 | n8n: the card's button label colour is the site's primary call-to-action label colour | #212121 | #212121 | passed |
| 135 | n8n: the card's button corners match the site's primary call-to-action within 2px or in class | 42px pill | 44px pill | passed |
| 136 | n8n: the card's button label is set in the site's call-to-action family | n8n Baumer Mono (monospace) | n8n Baumer Uniwidth (sans-serif) | failed: n8n Baumer Mono (monospace) vs n8n Baumer Uniwidth (sans-serif) |
| 137 | n8n: the card's button label has the site's call-to-action case | uppercase | uppercase | passed |
| 138 | n8n: the card's button label has the site's call-to-action letter-spacing | 0.020em | 0.000em | passed |
| 139 | n8n: the card's chart bars are the site's accent | #ff91ac (link text) | #161616 | failed: OKLab distance 0.596 > 0.05 |
| 140 | n8n: the card's corners match the site's bordered panels within 2px or in class | 34px rounded | 8px slightly rounded | failed: rounded vs slightly rounded |
| 141 | n8n: the card's chips match the site's button corners within 2px or in class | 42px pill | 25px pill | passed |
| 142 | n8n: the card's small labels are monospace exactly when the site's are | true | false | failed: true vs false |
| 143 | n8n: the card's small labels have the site's small-label case | uppercase | uppercase | passed |
| 144 | n8n: the card's small labels have the site's small-label letter-spacing | 0.020em | 0.000em | passed |
| 145 | Open Places: the card's surface is the site's page background | #f7f5ef | #f7f5ef | passed |
| 146 | Open Places: the card's text colour is the site's body text colour | #23261f | #23261f | passed |
| 147 | Open Places: the card's heading is set in the site's h1 family | Figtree (sans-serif) | Figtree (sans-serif) | passed |
| 148 | Open Places: the card's body text is set in the site's paragraph family | Figtree (sans-serif) | Figtree (sans-serif) | passed |
| 149 | Open Places: the card's button fill is the site's primary call-to-action fill | #3f5a2c | #3f5a2c | passed |
| 150 | Open Places: the card's button label colour is the site's primary call-to-action label colour | #ffffff | #ffffff | passed |
| 151 | Open Places: the card's button corners match the site's primary call-to-action within 2px or in class | 46px pill | 12px rounded | failed: pill vs rounded |
| 152 | Open Places: the card's button label is set in the site's call-to-action family | Figtree (sans-serif) | Figtree (sans-serif) | passed |
| 153 | Open Places: the card's button label has the site's call-to-action case | as written | uppercase | failed: as written vs uppercase |
| 154 | Open Places: the card's button label has the site's call-to-action letter-spacing | 0.000em | 0.000em | passed |
| 155 | Open Places: the card's chart bars are the site's accent | #3f5a2c (primary call-to-action fill) | #3f5a2c | passed |
| 156 | Open Places: the card's corners match the site's bordered panels within 2px or in class | 18px rounded | 22px rounded | passed |
| 157 | Open Places: the card's chips match the site's button corners within 2px or in class | 46px pill | 12px pill | passed |
| 158 | Open Places: the card's small labels are monospace exactly when the site's are | false | false | passed |
| 159 | Open Places: the card's small labels have the site's small-label case | as written | uppercase | failed: as written vs uppercase |
| 160 | Open Places: the card's small labels have the site's small-label letter-spacing | 0.000em | 0.000em | passed |
| 161 | Porkbun: the card's surface is the site's page background | not measured | #fef9f9 | untested: site capture blocked: HTTP 403 "" |
| 162 | Porkbun: the card's text colour is the site's body text colour | not measured | #000000 | untested: site capture blocked: HTTP 403 "" |
| 163 | Porkbun: the card's heading is set in the site's h1 family | not measured | Open Sans (sans-serif) | untested: site capture blocked: HTTP 403 "" |
| 164 | Porkbun: the card's body text is set in the site's paragraph family | not measured | Open Sans (sans-serif) | untested: site capture blocked: HTTP 403 "" |
| 165 | Porkbun: the card's button fill is the site's primary call-to-action fill | not measured | #ef7878 | untested: site capture blocked: HTTP 403 "" |
| 166 | Porkbun: the card's button label colour is the site's primary call-to-action label colour | not measured | #000000 | untested: site capture blocked: HTTP 403 "" |
| 167 | Porkbun: the card's button corners match the site's primary call-to-action within 2px or in class | not measured | 3px slightly rounded | untested: site capture blocked: HTTP 403 "" |
| 168 | Porkbun: the card's button label is set in the site's call-to-action family | not measured | Open Sans (sans-serif) | untested: site capture blocked: HTTP 403 "" |
| 169 | Porkbun: the card's button label has the site's call-to-action case | not measured | uppercase | untested: site capture blocked: HTTP 403 "" |
| 170 | Porkbun: the card's button label has the site's call-to-action letter-spacing | not measured | 0.000em | untested: site capture blocked: HTTP 403 "" |
| 171 | Porkbun: the card's chart bars are the site's accent | not measured | untested: no chart | untested: site capture blocked: HTTP 403 "" |
| 172 | Porkbun: the card's corners match the site's bordered panels within 2px or in class | not measured | 8px slightly rounded | untested: site capture blocked: HTTP 403 "" |
| 173 | Porkbun: the card's chips match the site's button corners within 2px or in class | not measured | 3px slightly rounded | untested: site capture blocked: HTTP 403 "" |
| 174 | Porkbun: the card's small labels are monospace exactly when the site's are | not measured | false | untested: site capture blocked: HTTP 403 "" |
| 175 | Porkbun: the card's small labels have the site's small-label case | not measured | uppercase | untested: site capture blocked: HTTP 403 "" |
| 176 | Porkbun: the card's small labels have the site's small-label letter-spacing | not measured | 0.000em | untested: site capture blocked: HTTP 403 "" |
| 177 | Spider: the card's surface is the site's page background | #0c0e13 | #0c0e13 | passed |
| 178 | Spider: the card's text colour is the site's body text colour | #f8fafc | #f8fafc | passed |
| 179 | Spider: the card's heading is set in the site's h1 family | Fraunces Variable (serif) | Fraunces Variable (serif) | passed |
| 180 | Spider: the card's body text is set in the site's paragraph family | Inter Variable (sans-serif) | Inter Variable (sans-serif) | passed |
| 181 | Spider: the card's button fill is the site's primary call-to-action fill | #f8fafc | #f8fafc | passed |
| 182 | Spider: the card's button label colour is the site's primary call-to-action label colour | #0c0e13 | #0c0e13 | passed |
| 183 | Spider: the card's button corners match the site's primary call-to-action within 2px or in class | 0px square | 0px square | passed |
| 184 | Spider: the card's button label is set in the site's call-to-action family | Berkeley (monospace) | Inter Variable (sans-serif) | failed: Berkeley (monospace) vs Inter Variable (sans-serif) |
| 185 | Spider: the card's button label has the site's call-to-action case | uppercase | uppercase | passed |
| 186 | Spider: the card's button label has the site's call-to-action letter-spacing | 0.140em | 0.000em | failed: 0.140em vs 0.000em |
| 187 | Spider: the card's chart bars are the site's accent | #3bde77 (highlighted heading text) | #24c45c | failed: OKLab distance 0.076 > 0.05 |
| 188 | Spider: the card's corners match the site's bordered panels within 2px or in class | 0px square | 8px slightly rounded | failed: square vs slightly rounded |
| 189 | Spider: the card's chips match the site's button corners within 2px or in class | 0px square | 0px square | passed |
| 190 | Spider: the card's small labels are monospace exactly when the site's are | true | false | failed: true vs false |
| 191 | Spider: the card's small labels have the site's small-label case | uppercase | uppercase | passed |
| 192 | Spider: the card's small labels have the site's small-label letter-spacing | 0.140em | 0.000em | failed: 0.140em vs 0.000em |

## How each site trait was located

- Clay surface: background-color of <body>, else <html>
- Clay headingFamily: font-family of the first visible <h1>
- Clay bodyFamily: font-family of the first visible <p> with 20+ characters outside header/nav, else the first div/span with 20+ characters of its own text outside headings, links and header/nav
- Clay buttonFill: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): background-color ("Get a demo")
- Clay buttonText: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): color of the element holding its label text
- Clay buttonRadius: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): border-top-left-radius
- Clay buttonFamily: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): font-family (monospace by equal glyph widths)
- Clay buttonCase: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): text-transform, or the label written in capitals
- Clay buttonTracking: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): letter-spacing / font-size
- Clay accent: most chromatic colour (OKLCH chroma 0.188, greys under 0.04 excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint
- Clay panelRadius: median border-top-left-radius of 1 visible bordered or filled boxes (4000px²+, under 90% of the width, not buttons)
- Clay labelMono: 14 visible elements with 2-30 characters of their own text at 14px or smaller: 0 monospace by equal glyph widths (share >= 0.3)
- Clay labelCase: 14 visible elements with 2-30 characters of their own text at 14px or smaller: 0 uppercase (share >= 0.3)
- Clay labelTracking: 14 visible elements with 2-30 characters of their own text at 14px or smaller: median letter-spacing / font-size of the ones as written
- Cloudflare surface: background-color of <body>, else <html>
- Cloudflare headingFamily: font-family of the first visible <h1>
- Cloudflare bodyFamily: font-family of the first visible <p> with 20+ characters outside header/nav, else the first div/span with 20+ characters of its own text outside headings, links and header/nav
- Cloudflare buttonFill: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): background-color ("Start building for free")
- Cloudflare buttonText: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): color of the element holding its label text
- Cloudflare buttonRadius: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): border-top-left-radius
- Cloudflare buttonFamily: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): font-family (monospace by equal glyph widths)
- Cloudflare buttonCase: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): text-transform, or the label written in capitals
- Cloudflare buttonTracking: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): letter-spacing / font-size
- Cloudflare accent: most chromatic colour (OKLCH chroma 0.209, greys under 0.04 excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint
- Context.dev surface: background-color of <body>, else <html>
- Context.dev text: of the text colours carrying 20+ characters of visible text straight on the page background (outside header/nav, links and buttons), the one with the highest WCAG contrast against that background
- Context.dev headingFamily: font-family of the first visible <h1>
- Context.dev buttonFill: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): background-color ("Start for free")
- Context.dev buttonText: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): color of the element holding its label text
- Context.dev buttonRadius: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): border-top-left-radius
- Context.dev buttonFamily: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): font-family (monospace by equal glyph widths)
- Context.dev buttonCase: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): text-transform, or the label written in capitals
- Context.dev buttonTracking: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): letter-spacing / font-size
- Context.dev accent: most chromatic colour (OKLCH chroma 0.215, greys under 0.04 excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint
- Context.dev panelRadius: median border-top-left-radius of 4 visible bordered or filled boxes (4000px²+, under 90% of the width, not buttons)
- Context.dev labelMono: 26 visible elements with 2-30 characters of their own text at 14px or smaller: 0 monospace by equal glyph widths (share >= 0.3)
- Context.dev labelCase: 26 visible elements with 2-30 characters of their own text at 14px or smaller: 0 uppercase (share >= 0.3)
- Context.dev labelTracking: 26 visible elements with 2-30 characters of their own text at 14px or smaller: median letter-spacing / font-size of the ones as written
- Docker surface: background-color of <body>, else <html>
- Docker headingFamily: font-family of the first visible <h1>
- Docker bodyFamily: font-family of the first visible <p> with 20+ characters outside header/nav, else the first div/span with 20+ characters of its own text outside headings, links and header/nav
- Docker buttonFill: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): background-color ("Get started")
- Docker buttonText: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): color of the element holding its label text
- Docker buttonRadius: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): border-top-left-radius
- Docker buttonFamily: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): font-family (monospace by equal glyph widths)
- Docker buttonCase: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): text-transform, or the label written in capitals
- Docker buttonTracking: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): letter-spacing / font-size
- Docker accent: most chromatic colour (OKLCH chroma 0.243, greys under 0.04 excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint
- Docker panelRadius: median border-top-left-radius of 2 visible bordered or filled boxes (4000px²+, under 90% of the width, not buttons)
- Docker labelMono: 17 visible elements with 2-30 characters of their own text at 14px or smaller: 0 monospace by equal glyph widths (share >= 0.3)
- Docker labelCase: 17 visible elements with 2-30 characters of their own text at 14px or smaller: 0 uppercase (share >= 0.3)
- Docker labelTracking: 17 visible elements with 2-30 characters of their own text at 14px or smaller: median letter-spacing / font-size of the ones as written
- Elicit surface: background-color of <body>, else <html>
- Elicit headingFamily: font-family of the first visible <h1>
- Elicit bodyFamily: font-family of the first visible <p> with 20+ characters outside header/nav, else the first div/span with 20+ characters of its own text outside headings, links and header/nav
- Elicit buttonFill: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): background-color ("Try now")
- Elicit buttonText: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): color of the element holding its label text
- Elicit buttonRadius: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): border-top-left-radius
- Elicit buttonFamily: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): font-family (monospace by equal glyph widths)
- Elicit buttonCase: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): text-transform, or the label written in capitals
- Elicit buttonTracking: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): letter-spacing / font-size
- Elicit accent: most chromatic colour (OKLCH chroma 0.079, greys under 0.04 excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint
- Exa surface: most common opaque background behind three page-margin points (no opaque <body> or <html>)
- Exa text: of the text colours carrying 20+ characters of visible text straight on the page background (outside header/nav, links and buttons), the one with the highest WCAG contrast against that background
- Exa headingFamily: font-family of the first visible <h1>
- Exa bodyFamily: font-family of the first visible <p> with 20+ characters outside header/nav, else the first div/span with 20+ characters of its own text outside headings, links and header/nav
- Exa buttonFill: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): background-color ("Try API for free")
- Exa buttonText: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): color of the element holding its label text
- Exa buttonRadius: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): border-top-left-radius
- Exa buttonFamily: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): font-family (monospace by equal glyph widths)
- Exa buttonCase: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): text-transform, or the label written in capitals
- Exa buttonTracking: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): letter-spacing / font-size
- Exa accent: most chromatic colour (OKLCH chroma 0.257, greys under 0.04 excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint
- Exa panelRadius: median border-top-left-radius of 5 visible bordered or filled boxes (4000px²+, under 90% of the width, not buttons)
- Exa labelMono: 26 visible elements with 2-30 characters of their own text at 14px or smaller: 6 monospace by equal glyph widths (share >= 0.3)
- Exa labelCase: 26 visible elements with 2-30 characters of their own text at 14px or smaller: 3 uppercase (share >= 0.3)
- Exa labelTracking: 26 visible elements with 2-30 characters of their own text at 14px or smaller: median letter-spacing / font-size of the ones as written
- Firecrawl surface: background-color of <body>, else <html>
- Firecrawl text: of the text colours carrying 20+ characters of visible text straight on the page background (outside header/nav, links and buttons), the one with the highest WCAG contrast against that background
- Firecrawl headingFamily: font-family of the first visible <h1>
- Firecrawl bodyFamily: font-family of the first visible <p> with 20+ characters outside header/nav, else the first div/span with 20+ characters of its own text outside headings, links and header/nav
- Firecrawl buttonFill: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): background-color ("Start for free")
- Firecrawl buttonText: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): color of the element holding its label text
- Firecrawl buttonRadius: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): border-top-left-radius
- Firecrawl buttonFamily: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): font-family (monospace by equal glyph widths)
- Firecrawl buttonCase: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): text-transform, or the label written in capitals
- Firecrawl buttonTracking: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): letter-spacing / font-size
- Firecrawl accent: most chromatic colour (OKLCH chroma 0.224, greys under 0.04 excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint
- Firecrawl panelRadius: median border-top-left-radius of 2 visible bordered or filled boxes (4000px²+, under 90% of the width, not buttons)
- Firecrawl labelMono: 19 visible elements with 2-30 characters of their own text at 14px or smaller: 1 monospace by equal glyph widths (share >= 0.3)
- Firecrawl labelCase: 19 visible elements with 2-30 characters of their own text at 14px or smaller: 0 uppercase (share >= 0.3)
- Firecrawl labelTracking: 19 visible elements with 2-30 characters of their own text at 14px or smaller: median letter-spacing / font-size of the ones as written
- GitHub surface: background-color of <body>, else <html>
- GitHub text: of the text colours carrying 20+ characters of visible text straight on the page background (outside header/nav, links and buttons), the one with the highest WCAG contrast against that background
- GitHub headingFamily: font-family of the first visible <h1>
- GitHub buttonFill: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): background-color ("Sign up for GitHub")
- GitHub buttonText: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): color of the element holding its label text
- GitHub buttonRadius: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): border-top-left-radius
- GitHub buttonFamily: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): font-family (monospace by equal glyph widths)
- GitHub buttonCase: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): text-transform, or the label written in capitals
- GitHub buttonTracking: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): letter-spacing / font-size
- GitHub accent: most chromatic colour (OKLCH chroma 0.191, greys under 0.04 excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint
- GitHub panelRadius: median border-top-left-radius of 2 visible bordered or filled boxes (4000px²+, under 90% of the width, not buttons)
- GitHub labelMono: 10 visible elements with 2-30 characters of their own text at 14px or smaller: 0 monospace by equal glyph widths (share >= 0.3)
- GitHub labelCase: 10 visible elements with 2-30 characters of their own text at 14px or smaller: 0 uppercase (share >= 0.3)
- GitHub labelTracking: 10 visible elements with 2-30 characters of their own text at 14px or smaller: median letter-spacing / font-size of the ones as written
- n8n surface: background-color of <body>, else <html>
- n8n text: of the text colours carrying 20+ characters of visible text straight on the page background (outside header/nav, links and buttons), the one with the highest WCAG contrast against that background
- n8n headingFamily: font-family of the first visible <h1>
- n8n bodyFamily: font-family of the first visible <p> with 20+ characters outside header/nav, else the first div/span with 20+ characters of its own text outside headings, links and header/nav
- n8n buttonFill: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): background-color ("GET STARTED")
- n8n buttonText: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): color of the element holding its label text
- n8n buttonRadius: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): border-top-left-radius
- n8n buttonFamily: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): font-family (monospace by equal glyph widths)
- n8n buttonCase: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): text-transform, or the label written in capitals
- n8n buttonTracking: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): letter-spacing / font-size
- n8n accent: most chromatic colour (OKLCH chroma 0.135, greys under 0.04 excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint
- n8n panelRadius: median border-top-left-radius of 4 visible bordered or filled boxes (4000px²+, under 90% of the width, not buttons)
- n8n labelMono: 13 visible elements with 2-30 characters of their own text at 14px or smaller: 12 monospace by equal glyph widths (share >= 0.3)
- n8n labelCase: 13 visible elements with 2-30 characters of their own text at 14px or smaller: 12 uppercase (share >= 0.3)
- n8n labelTracking: 13 visible elements with 2-30 characters of their own text at 14px or smaller: median letter-spacing / font-size of the uppercase ones
- Open Places surface: background-color of <body>, else <html>
- Open Places text: of the text colours carrying 20+ characters of visible text straight on the page background (outside header/nav, links and buttons), the one with the highest WCAG contrast against that background
- Open Places headingFamily: font-family of the first visible <h1>
- Open Places bodyFamily: font-family of the first visible <p> with 20+ characters outside header/nav, else the first div/span with 20+ characters of its own text outside headings, links and header/nav
- Open Places buttonFill: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): background-color ("Build this list
→")
- Open Places buttonText: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): color of the element holding its label text
- Open Places buttonRadius: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): border-top-left-radius
- Open Places buttonFamily: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): font-family (monospace by equal glyph widths)
- Open Places buttonCase: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): text-transform, or the label written in capitals
- Open Places buttonTracking: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): letter-spacing / font-size
- Open Places accent: most chromatic colour (OKLCH chroma 0.078, greys under 0.04 excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint
- Open Places panelRadius: median border-top-left-radius of 1 visible bordered or filled boxes (4000px²+, under 90% of the width, not buttons)
- Open Places labelMono: 6 visible elements with 2-30 characters of their own text at 14px or smaller: 0 monospace by equal glyph widths (share >= 0.3)
- Open Places labelCase: 6 visible elements with 2-30 characters of their own text at 14px or smaller: 0 uppercase (share >= 0.3)
- Open Places labelTracking: 6 visible elements with 2-30 characters of their own text at 14px or smaller: median letter-spacing / font-size of the ones as written
- Spider surface: background-color of <body>, else <html>
- Spider text: of the text colours carrying 20+ characters of visible text straight on the page background (outside header/nav, links and buttons), the one with the highest WCAG contrast against that background
- Spider headingFamily: font-family of the first visible <h1>
- Spider bodyFamily: font-family of the first visible <p> with 20+ characters outside header/nav, else the first div/span with 20+ characters of its own text outside headings, links and header/nav
- Spider buttonFill: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): background-color ("GET STARTED FREE")
- Spider buttonText: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): color of the element holding its label text
- Spider buttonRadius: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): border-top-left-radius
- Spider buttonFamily: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): font-family (monospace by equal glyph widths)
- Spider buttonCase: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): text-transform, or the label written in capitals
- Spider buttonTracking: visible link/button 60-500px wide, 28-90px tall, 2-40 characters, with a fill unlike the surface behind it, outside header/nav when any is; among those, coloured fills (OKLCH chroma >= 0.04) before greys, then the one standing off its nearest opaque ancestor most (WCAG contrast): letter-spacing / font-size
- Spider accent: most chromatic colour (OKLCH chroma 0.195, greys under 0.04 excluded) among the primary call-to-action fill, visible link text (not the browser's default link blue or purple), h1 descendants in another colour and inline-svg logo paint
- Spider panelRadius: median border-top-left-radius of 1 visible bordered or filled boxes (4000px²+, under 90% of the width, not buttons)
- Spider labelMono: 17 visible elements with 2-30 characters of their own text at 14px or smaller: 17 monospace by equal glyph widths (share >= 0.3)
- Spider labelCase: 17 visible elements with 2-30 characters of their own text at 14px or smaller: 13 uppercase (share >= 0.3)
- Spider labelTracking: 17 visible elements with 2-30 characters of their own text at 14px or smaller: median letter-spacing / font-size of the uppercase ones
