import fs from 'fs';
import path from 'path';

import type { Page, WebSocket } from '@playwright/test';

import { test, expect, type Fixtures } from './fixtures';
import { SERVER_PORT, tempDir, templateRoot } from './shared';

test.beforeEach(async ({ serverFilePath }) => {
	await fs.promises.cp(templateRoot, serverFilePath.filePath, {
		recursive: true,
	});
});

const updateCSS = async (
	page: Page,
	serverFilePath: Fixtures['serverFilePath'],
) => {
	// do something which receives a WS message
	const cssPath = path.join(serverFilePath.filePath, 'styles.css');
	const cssContents = await fs.promises.readFile(cssPath, 'utf-8');

	const evaluate = page.evaluate(() => {
		return new Promise<{ eventName: string; data: {} }>((resolve) => {
			// Assuming the page has already created a `socket` instance
			const _window = window as typeof window & { '__whr-socket': any };
			_window['__whr-socket'].onAny((eventName, data) => {
				return resolve({ eventName, data });
			});
		});
	});
	const updateFile = fs.promises.writeFile(
		cssPath,
		cssContents.replace('red', 'blue'),
	);

	const [payload] = await Promise.all([evaluate, updateFile]);

	expect(payload).toEqual({
		eventName: 'css-update',
		data: {
			fileName: `${tempDir}/test-0/styles.css`,
		},
	});

	// TODO(bret): wait for websocket event
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 1e3));
};

test('has title', async ({ page, serverFilePath }) => {
	await page.goto(serverFilePath.url);

	// Expect a title "to contain" a substring.
	// Expect a title "to contain" a substring.
	await expect(page).toHaveTitle(/My Site/);

	const body = page.locator('body');
	{
		const bgColor = await body.evaluate((b) => {
			return window.getComputedStyle(b).getPropertyValue('background-color');
		});
		expect(bgColor).toEqual('rgb(255, 0, 0)');
	}

	await updateCSS(page, serverFilePath);

	{
		const bgColor = await body.evaluate((b) => {
			return window.getComputedStyle(b).getPropertyValue('background-color');
		});
		expect(bgColor).toEqual('rgb(0, 0, 255)');
	}
});

// test('has title 2', async ({ page, serverFilePath }) => {
// 	console.log({ ay: 2, serverFilePath });
// 	// expect(serverFilePath.value).toEqual('some data2');
// });
