# Origins copy correction, September 22, 2026

Base source: `27c908fea2f4b3084bb3ab847102bb422b9b7c6c`.

The owner directed removal of the added language-history framing. Removed the entire "The language we borrow" section, its two paragraphs and its dictionary links from the shared Origins document. The HTML page and Markdown twin use that same source. The metadata description now describes the product context. The remaining product narrative, business identity and Aretha quotation are unchanged.

Updated the existing navigation assertion to check the retained "What it means here" section. Fourteen existing browser tests passed across trust pages, HTML/Markdown parity, mobile/desktop layout, themes and navigation. Focused ESLint passed. Local test startup used webpack because this isolated worktree's shared node_modules path is outside the Turbopack root; hosted CI uses the normal configuration. Generated Next type-path changes and the temporary test config were removed.

Before this correction, the authorized frontend release of the base source completed as deployment `dpl_9xFR4yFrZdjq7pVfSs5WdFF8iu3K`. Candidate and production each passed 69 HTTP assertions. The actual published-profile WebMCP result was identical before and after promotion. No Convex deployment, Clerk/OAuth/DNS change or remote MCP release occurred.

A fresh forced Ora scan completed at 2026-09-22T15:39:22.763Z with 69/100, grade C, contract1.25.0 and no pending checks. The following score GET agreed. Agent instructions improved from2/3 to3/3, trust pages from0/2 to2/2, and three sampled public docs passed the access check. The first unforced POST returned a cached66 result and was not treated as a fresh scan. The 90+ goal remains open. The copy correction itself still requires merge and production verification.
