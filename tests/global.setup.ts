import fs from 'node:fs';

import { expect, test as setup } from './fixtures';
import { SERVER_PORT, tempRoot, WHR_PORT } from './shared';

setup('setup', async ({ request }) => {
	if (fs.existsSync(tempRoot)) {
		fs.rmSync(tempRoot, {
			recursive: true,
		});
	}
	fs.mkdirSync(tempRoot);

	// ensure both servers are up & running
	{
		const url = `http://localhost:${SERVER_PORT}`;
		const res = await request.head(url);
		expect(res.ok()).toBeTruthy();
	}
	{
		const url = `http://localhost:${WHR_PORT}/reloader.js`;
		const res = await request.head(url);
		expect(res.ok()).toBeTruthy();
	}
});
