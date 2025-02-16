import fs from 'fs';
import path from 'path';

import type { Page } from '@playwright/test';

import {
	test,
	expect,
	type Fixtures,
	constructServerFilePath,
} from './fixtures';
import { tempDir, templateRoot } from './shared';

test.beforeEach(async ({ serverFilePath }) => {
	if (fs.existsSync(serverFilePath.filePath)) return;
	await fs.promises.cp(templateRoot, serverFilePath.filePath, {
		recursive: true,
	});
});

const expectBgColor = async (page: Page) => {
	const body = page.locator('body');
	const bgColor = await body.evaluate((b) => {
		return window.getComputedStyle(b).getPropertyValue('background-color');
	});
	return bgColor;
};

const waitForWebSocketEvent = (page: Page, event: string) => {
	return page.evaluate(() => {
		return new Promise<{ eventName: string; data: {} }>((resolve) => {
			const _window = window as typeof window & { '__whr-socket': any };
			_window['__whr-socket'].onAny((eventName, data) => {
				resolve({ eventName, data });
			});
		});
	});
};

const updateCSS = async (
	page: Page,
	serverFilePath: Fixtures['serverFilePath'],
	color: string,
) => {
	const cssPath = path.join(serverFilePath.filePath, 'styles.css');
	const cssContents = await fs.promises.readFile(cssPath, 'utf-8');

	const evaluate = waitForWebSocketEvent(page, 'css-update');
	const updateFile = fs.promises.writeFile(
		cssPath,
		cssContents.replace(/background: .+;/, `background: ${color};`),
	);

	const [payload] = await Promise.all([evaluate, updateFile]);

	expect(payload).toMatchObject({
		eventName: 'css-update',
		data: {
			fileName: `${tempDir}/${serverFilePath.path}/styles.css`,
		},
	});

	// TODO(bret): wait for websocket event
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 1e3));
};

const updateHTML = async (
	page: Page,
	serverFilePath: Fixtures['serverFilePath'],
) => {
	const htmlPath = path.join(serverFilePath.filePath, 'index.html');
	const htmlContents = await fs.promises.readFile(htmlPath, 'utf-8');

	const evaluate = waitForWebSocketEvent(page, 'html-update');
	const updateFile = fs.promises.writeFile(
		htmlPath,
		htmlContents.replace('My Site', 'My Cool Site'),
	);

	const [payload] = await Promise.all([evaluate, updateFile]);

	expect(payload).toMatchObject({
		eventName: 'html-update',
		data: {
			fileName: `${tempDir}/${serverFilePath.path}/index.html`,
		},
	});

	// TODO(bret): wait for websocket event
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 1e3));
};

test('edit CSS', async ({ page, serverFilePath }) => {
	await page.goto(serverFilePath.url);
	expect(await expectBgColor(page)).toEqual('rgb(255, 0, 0)');
	await updateCSS(page, serverFilePath, 'blue');
	expect(await expectBgColor(page)).toEqual('rgb(0, 0, 255)');
});

test('edit HTML', async ({ page, serverFilePath }) => {
	await page.goto(serverFilePath.url);
	await expect(page).toHaveTitle(/My Site/);
	await updateHTML(page, serverFilePath);
	await expect(page).toHaveTitle(/My Cool Site/);
});

// TODO(bret): Make sure only the HTML page that is currently loaded refreshes!!

test.describe.serial('edit CSS then HTML', () => {
	test.use({ serverFilePath: constructServerFilePath() });

	let page: Page;
	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		// resolve(page);
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("ensure HTML changes don't override CSS changes", async ({
		serverFilePath,
	}) => {
		await page.goto(serverFilePath.url);

		expect(await expectBgColor(page)).toEqual('rgb(255, 0, 0)');
		await updateCSS(page, serverFilePath, 'blue');
		expect(await expectBgColor(page)).toEqual('rgb(0, 0, 255)');
		await expect(page).toHaveTitle(/My Site/);
		await updateHTML(page, serverFilePath);
		await expect(page).toHaveTitle(/My Cool Site/);

		// the background color should NOT be reset!
		expect(await expectBgColor(page)).toEqual('rgb(0, 0, 255)');
	});

	test('ensure new CSS changes are applied', async ({ serverFilePath }) => {
		await updateCSS(page, serverFilePath, 'lime');
		expect(await expectBgColor(page)).toEqual('rgb(0, 255, 0)');
	});
});

// test('has title 2', async ({ page, serverFilePath }) => {
// 	console.log({ ay: 2, serverFilePath });
// 	// expect(serverFilePath.value).toEqual('some data2');
// });
