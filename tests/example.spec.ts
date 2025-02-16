import fs from 'fs';
import path from 'path';

import type { Page } from '@playwright/test';

import { test, expect, type Fixtures } from './fixtures';
import { tempDir, templateRoot } from './shared';

test.beforeEach(async ({ serverFilePath }) => {
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

const waitForWebSocketEvent = (page: Page) => {
	return page.evaluate(() => {
		return new Promise<{ eventName: string; data: {} }>((resolve) => {
			const _window = window as typeof window & { '__whr-socket': any };
			_window['__whr-socket'].onAny((eventName, data) => {
				return resolve({ eventName, data });
			});
		});
	});
};

const updateCSS = async (
	page: Page,
	serverFilePath: Fixtures['serverFilePath'],
) => {
	const cssPath = path.join(serverFilePath.filePath, 'styles.css');
	const cssContents = await fs.promises.readFile(cssPath, 'utf-8');

	const evaluate = waitForWebSocketEvent(page);
	const updateFile = fs.promises.writeFile(
		cssPath,
		cssContents.replace('red', 'blue'),
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

	const evaluate = waitForWebSocketEvent(page);
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
	await updateCSS(page, serverFilePath);
	expect(await expectBgColor(page)).toEqual('rgb(0, 0, 255)');
});

test('edit HTML', async ({ page, serverFilePath }) => {
	await page.goto(serverFilePath.url);
	await expect(page).toHaveTitle(/My Site/);
	await updateHTML(page, serverFilePath);
	await expect(page).toHaveTitle(/My Cool Site/);
});

test('edit CSS then HTML', async ({ page, serverFilePath }) => {
	await page.goto(serverFilePath.url);

	expect(await expectBgColor(page)).toEqual('rgb(255, 0, 0)');
	await updateCSS(page, serverFilePath);
	expect(await expectBgColor(page)).toEqual('rgb(0, 0, 255)');

	await expect(page).toHaveTitle(/My Site/);
	await updateHTML(page, serverFilePath);
	await expect(page).toHaveTitle(/My Cool Site/);

	// the background color should NOT be reset!
	expect(await expectBgColor(page)).toEqual('rgb(0, 0, 255)');
});

// test('has title 2', async ({ page, serverFilePath }) => {
// 	console.log({ ay: 2, serverFilePath });
// 	// expect(serverFilePath.value).toEqual('some data2');
// });
