// Synthetic fixtures, authored 2026-09-16. No user records or live evidence.
export const AS_OF = '2026-09-16';
export const accountOptions = {
  gmail: [
    { id: 'g-personal', email: 'morgan.personal@example.com', label: 'Personal', provider: 'gmail' },
    { id: 'g-studio', email: 'morgan.studio@example.com', label: 'Studio', provider: 'gmail' },
  ],
  outlook: [
    { id: 'o-current', email: 'morgan@current-work.example', label: 'Current workplace', provider: 'outlook' },
    { id: 'o-former', email: 'morgan@former-work.example', label: 'Former workplace', provider: 'outlook' },
  ],
  github: [
    { id: 'gh-personal', email: 'morgan-sample', label: 'Personal GitHub', provider: 'github' },
    { id: 'gh-work', email: 'morgan-work-sample', label: 'Work GitHub', provider: 'github' },
  ],
};
export const providers = { gmail: 'Gmail', outlook: 'Outlook', github: 'GitHub' };
export const products = [
  { id: 'github', name: 'GitHub', url: 'https://github.com', status: 'Active', introducer: 'Rae, at a local builders meetup', affiliate: '', observed: '2026-09-15', method: 'Sample GitHub API', subtitle: 'The work behind the work.', hint: 'A repository notification mentions GitHub. A mention alone does not establish usage.' },
  { id: 'notion', name: 'Notion', url: 'https://www.notion.com', status: 'Tried', introducer: 'The Studio Notes community', affiliate: 'https://example.com/ref/studio-notes', observed: '2026-09-12', method: 'Sample owner snapshot', subtitle: 'Ideas that became something.', hint: 'A workspace invitation mentions Notion. An invitation alone does not establish usage.' },
  { id: 'slack', name: 'Slack', url: 'https://slack.com', status: 'Archived', introducer: '', affiliate: '', observed: '2026-08-10', method: 'Sample owner snapshot', subtitle: 'Where the team came together.', hint: 'A billing email mentions Slack. Payment alone does not establish usage.' },
];
export const contributions = Array.from({ length: 182 }, (_, i) => ((i * 13 + 7) % 19 < 9 ? 0 : (i * 7) % 5 + 1));
export const contributionTotal = contributions.reduce((a, b) => a + b, 0);
