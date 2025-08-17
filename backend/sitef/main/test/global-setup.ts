import childProcess from 'node:child_process';
import path from 'node:path';

// Global setup runs inside Node.js, not `workerd`
export default function () {
	let label = 'Built main-d1 worker';
	console.time(label);
	childProcess.execSync('wrangler build -c ./wrangler.dev.jsonc', {
		cwd: path.join(__dirname, '../../../main-d1'),
	});
	console.timeEnd(label);

	label = 'Built main-r2 worker';
	console.time(label);
	childProcess.execSync('wrangler build -c ./wrangler.dev.jsonc', {
		cwd: path.join(__dirname, '../../../main-r2'),
	});
	console.timeEnd(label);
}
