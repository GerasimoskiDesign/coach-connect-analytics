// GitHub Pages has no server-side routing. Serving index.html as 404.html makes
// deep links such as /coach-connect-analytics/coaches load the Angular app,
// which then routes on the client.
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './tracking-plan.mjs';

const dir = join(ROOT, 'dist', 'coach-connect-analytics', 'browser');
copyFileSync(join(dir, 'index.html'), join(dir, '404.html'));
console.log('Wrote 404.html SPA fallback');
