import fs from 'fs';
import path from 'path';

import type { Page } from '@playwright/test';

import { test, expect, type Fixtures, describeSerial } from './fixtures';
import { tempDir, templateRoot } from './shared';

test.beforeEach(async ({ serverFilePath }) => {
	if (fs.existsSync(serverFilePath.filePath)) return;
	await fs.promises.cp(templateRoot, serverFilePath.filePath, {
		recursive: true,
	});
});

const expectStyle = async (
	page: Page,
	property: Exclude<keyof CSSStyleDeclaration, number | Symbol>,
) => {
	console.log('expect style yo', property);
	const body = page.locator('body');
	const computedStyle = await body.evaluate((b, property) => {
		return window.getComputedStyle(b)[property];
	}, property);
	return computedStyle;
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

type CSSFile = 'styles.css' | 'styles2.css' | 'styles3.css';
type HTMLFile = 'index.html' | 'page-two.html' | 'sub-dir/index.html';

const updateCSS = async (
	page: Page,
	fileName: CSSFile,
	serverFilePath: Fixtures['serverFilePath'],
	options: {
		background?: string;
		color?: string;
	},
) => {
	const cssPath = path.join(serverFilePath.filePath, fileName);
	const cssContents = await fs.promises.readFile(cssPath, 'utf-8');

	const evaluate = waitForWebSocketEvent(page, 'css-update');

	let newContents = cssContents;
	const { background, color } = options;
	if (background) {
		newContents = newContents.replace(
			/background-color: .+;/,
			`background-color: ${background};`,
		);
	}
	if (color) {
		newContents = newContents.replace(/color: .+;/, `color: ${color};`);
	}

	const updateFile = fs.promises.writeFile(cssPath, newContents);

	const [payload] = await Promise.all([evaluate, updateFile]);

	expect(payload).toMatchObject({
		eventName: 'css-update',
		data: {
			fileName: `${tempDir}/${serverFilePath.path}/${fileName}`,
		},
	});

	// TODO(bret): wait for websocket event
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 1e3));
};

const updateHTML = async (
	page: Page,
	fileName: HTMLFile,
	serverFilePath: Fixtures['serverFilePath'],
	replacement: (str: string) => string,
) => {
	const htmlPath = path.join(serverFilePath.filePath, fileName);
	const htmlContents = await fs.promises.readFile(htmlPath, 'utf-8');

	const evaluate = waitForWebSocketEvent(page, 'html-update');
	const updateFile = fs.promises.writeFile(htmlPath, replacement(htmlContents));

	const [payload] = await Promise.all([evaluate, updateFile]);

	expect(payload).toMatchObject({
		eventName: 'html-update',
		data: {
			fileName: `${tempDir}/${serverFilePath.path}/${fileName}`,
		},
	});

	// TODO(bret): wait for websocket event
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 1e3));
};

const defaultBGColor = 'rgb(255, 0, 0)';
const defaultColor = 'rgb(255, 255, 255)';

describeSerial('edit CSS', () => {
	let background = defaultBGColor;
	let color = defaultColor;

	test('ensure edits are received', async ({ page, serverFilePath }) => {
		await page.goto(serverFilePath.url);
		console.log('what is happening');
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);

		background = 'rgb(0, 0, 255)';
		await updateCSS(page, 'styles.css', serverFilePath, {
			background,
		});
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);
	});

	test('ensure multiple files are received', async ({
		page,
		serverFilePath,
	}) => {
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);

		color = 'rgb(0, 0, 0)';
		await updateCSS(page, 'styles2.css', serverFilePath, { color });
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);
	});

	test('ensure non-included files are ignored client-side', async ({
		page,
		serverFilePath,
	}) => {
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);

		await updateCSS(page, 'styles3.css', serverFilePath, {
			background: 'magenta',
			color: 'magenta',
		});
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);
	});
});

test.describe('edit index.html', () => {
	['', 'index', 'index.html'].forEach((fileName) => {
		describeSerial(`as "/${fileName}"`, () => {
			let pageTitle = 'My Site';

			test('ensure changes are received', async ({ page, serverFilePath }) => {
				const url = serverFilePath.url + fileName;
				await page.goto(url);
				await expect(page).toHaveTitle(pageTitle);
				pageTitle = 'My Cool Site';
				await updateHTML(page, 'index.html', serverFilePath, (htmlContents) =>
					htmlContents.replace('My Site', pageTitle),
				);
				await expect(page).toHaveTitle(pageTitle);
			});

			test('ensure changes to another .html file are not received', async ({
				page,
				serverFilePath,
			}) => {
				await expect(page).toHaveTitle(pageTitle);
				await updateHTML(
					page,
					'page-two.html',
					serverFilePath,
					(htmlContents) => htmlContents.replace('Page Two', 'Page II'),
				);
				await expect(page).toHaveTitle(pageTitle);
			});

			test('ensure changes to another index.html file are not received', async ({
				page,
				serverFilePath,
			}) => {
				await expect(page).toHaveTitle(pageTitle);
				await updateHTML(
					page,
					'sub-dir/index.html',
					serverFilePath,
					(htmlContents) => htmlContents.replace('A Subdirectory', 'A Sub Dir'),
				);
				await expect(page).toHaveTitle(pageTitle);
			});
		});
	});
});

test.describe('edit page-two.html', () => {
	['page-two', 'page-two.html'].forEach((fileName) => {
		describeSerial(`as "/${fileName}"`, () => {
			let pageTitle = 'Page Two';
			test('ensure changes are received', async ({ page, serverFilePath }) => {
				await page.goto(serverFilePath.url + fileName);
				await expect(page).toHaveTitle(pageTitle);
				pageTitle = 'Page II';
				await updateHTML(
					page,
					'page-two.html',
					serverFilePath,
					(htmlContents) => htmlContents.replace('Page Two', pageTitle),
				);
				await expect(page).toHaveTitle(pageTitle);
			});

			test('ensure changes to another .html file are not received', async ({
				page,
				serverFilePath,
			}) => {
				await expect(page).toHaveTitle(pageTitle);
				await updateHTML(page, 'index.html', serverFilePath, (htmlContents) =>
					htmlContents.replace('My Site', 'My Cool Site'),
				);
				await expect(page).toHaveTitle(pageTitle);
			});
		});
	});
});

test.describe('edit sub-dir/index.html', () => {
	['', 'index', 'index.html'].forEach((fileName) => {
		describeSerial(`as "/${fileName}"`, () => {
			let pageTitle = 'A Subdirectory';

			test('ensure changes are received', async ({ page, serverFilePath }) => {
				const url = serverFilePath.url + 'sub-dir/' + fileName;
				await page.goto(url);
				await expect(page).toHaveTitle(pageTitle);
				pageTitle = 'A Sub Dir';
				await updateHTML(
					page,
					'sub-dir/index.html',
					serverFilePath,
					(htmlContents) => htmlContents.replace('A Subdirectory', pageTitle),
				);
				await expect(page).toHaveTitle(pageTitle);
			});

			test('ensure changes to another .html file are not received', async ({
				page,
				serverFilePath,
			}) => {
				await expect(page).toHaveTitle(pageTitle);
				await updateHTML(
					page,
					'page-two.html',
					serverFilePath,
					(htmlContents) => htmlContents.replace('Page Two', 'Page II'),
				);
				await expect(page).toHaveTitle(pageTitle);
			});

			test('ensure changes to another index.html file are not received', async ({
				page,
				serverFilePath,
			}) => {
				await expect(page).toHaveTitle(pageTitle);
				await updateHTML(page, 'index.html', serverFilePath, (htmlContents) =>
					htmlContents.replace('My Site', 'My Cool Site'),
				);
				await expect(page).toHaveTitle(pageTitle);
			});
		});
	});
});

// TODO(bret): Make sure only the HTML page that is currently loaded refreshes!!

describeSerial('edit CSS then HTML', () => {
	test("ensure HTML changes don't override CSS changes", async ({
		page,
		serverFilePath,
	}) => {
		await page.goto(serverFilePath.url);

		expect(await expectStyle(page, 'backgroundColor')).toEqual(
			'rgb(255, 0, 0)',
		);
		await updateCSS(page, 'styles.css', serverFilePath, { background: 'blue' });
		expect(await expectStyle(page, 'backgroundColor')).toEqual(
			'rgb(0, 0, 255)',
		);
		await expect(page).toHaveTitle(/My Site/);
		await updateHTML(page, 'index.html', serverFilePath, (htmlContents) =>
			htmlContents.replace('My Site', 'My Cool Site'),
		);
		await expect(page).toHaveTitle(/My Cool Site/);

		// the background color should NOT be reset!
		expect(await expectStyle(page, 'backgroundColor')).toEqual(
			'rgb(0, 0, 255)',
		);
	});

	test('ensure new CSS changes are applied', async ({
		page,
		serverFilePath,
	}) => {
		await updateCSS(page, 'styles.css', serverFilePath, { background: 'lime' });
		expect(await expectStyle(page, 'backgroundColor')).toEqual(
			'rgb(0, 255, 0)',
		);
	});
});
