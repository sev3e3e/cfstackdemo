import childProcess from 'node:child_process';
import path from 'node:path';

// Global setup runs inside Node.js, not `workerd`
export default function () {
	let label = 'Built fetcher worker';
	console.time(label);
	childProcess.execSync('wrangler build -c ./wrangler.jsonc', {
		cwd: path.join(__dirname, '../../fetcher'),
	});
	console.timeEnd(label);
}
