import fs from 'node:fs';

import { tempRoot } from './shared';
import { FullConfig } from '@playwright/test';

async function setup(config: FullConfig) {
	if (fs.existsSync(tempRoot)) {
		fs.rmSync(tempRoot, {
			recursive: true,
		});
	}
	fs.mkdirSync(tempRoot);
}

export default setup;
