import { expect, test as setup } from './fixtures/fixtures';
import { SERVER_PORT, WHR_PORT } from './shared';

setup('setup', async ({ request }) => {
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

	// TODO: context.addInitScript (inject the hot reloader!!)
});
