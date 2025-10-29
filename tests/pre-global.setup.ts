import fs from 'node:fs';

import { tempRoot } from './shared';

async function setup() {
	if (fs.existsSync(tempRoot)) {
		fs.rmSync(tempRoot, {
			recursive: true,
		});
	}
	fs.mkdirSync(tempRoot);
}

export default setup;
