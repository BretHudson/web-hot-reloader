import path from 'node:path';
import {
	test as baseTest,
	expect as baseExpect,
	type Page,
	Locator,
} from '@playwright/test';

import { tempRoot, SERVER_PORT, tempDir } from './shared';

export interface ServerFilePath {
	path: string;
	url: string;
	filePath: string;
}

export interface Fixtures {
	serverFilePath: ServerFilePath;
}

let count = 0;

const constructServerFilePath = () => {
	const _path = `test-${count++}`;
	const data = {
		path: _path,
		url: `http://localhost:${SERVER_PORT}/${tempDir}/${_path}/`,
		filePath: path.join(tempRoot, _path),
	};

	// if (!fs.existsSync(data.filePath)) {
	// 	fs.cpSync(templateRoot, data.filePath, {
	// 		recursive: true,
	// 	});
	// }

	return data;
};

export * from '@playwright/test';
export const test = baseTest.extend<Fixtures>({
	serverFilePath: [
		async ({}, use) => {
			const data = constructServerFilePath();
			await use(data);
		},
		{ option: true, scope: 'test' },
	],
});

// TODO(bret): Move this
export class WHRLocator {
	locator: Locator;
	attr: string;
	page: Page;
	constructor(page: Page, attr: string, filePath: string) {
		const selector = `[${attr}^="${filePath}"]`;
		this.locator = page.locator(selector);
		this.attr = attr;
		this.page = page;
	}
}

export const expect = baseExpect.extend({
	async WHR_toNotBeReloaded(received: WHRLocator) {
		const { locator, attr } = received;
		await locator.waitFor({ state: 'attached' });
		const link = await locator.getAttribute(attr);
		if (!link) {
			return {
				message: () => `attribute "${attr}" not present on element`,
				pass: false,
			};
		}
		const pass = !link.includes('?');
		return {
			message: () => (pass ? 'passed' : `element has already been reloaded`),
			pass,
		};
	},

	async WHR_toBeReloaded(received: WHRLocator) {
		const { page, locator, attr } = received;
		await locator.waitFor({ state: 'attached' });
		try {
			const good = await page.waitForFunction(
				(el) => el?.getAttribute(attr)?.includes('?'),
				await locator.elementHandle(),
				{ timeout: 10e3 },
			);

			return {
				message: () => 'passed',
				pass: Boolean(good),
			};
		} catch {
			return {
				message: () => 'element has not been reloaded via WHR',
				pass: true,
			};
		}
	},
});

export const describeSerial = (title: string, callback: () => void) => {
	test.describe(title, async () => {
		let page: Page;

		const serverFilePath = constructServerFilePath();

		test.use({
			serverFilePath: async ({}, use) => {
				return use(serverFilePath);
			},
			page: async ({ browser }, use) => {
				page ??= await browser.newPage();
				return use(page);
			},
		});

		test.describe.configure({ mode: 'serial' });

		test.beforeAll(async ({ browser }) => {
			page ??= await browser.newPage();
		});

		test.afterAll(async () => {
			await page.close();
		});

		callback();
	});
};
