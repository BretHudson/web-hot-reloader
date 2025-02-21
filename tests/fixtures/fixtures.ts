import fs from 'node:fs';
import path from 'node:path';

import { test as baseTest, Browser, mergeExpects } from '@playwright/test';

import { expect as toBeReloaded } from './matchers/toBeReloaded';
import { expect as toHavePageTitle } from './matchers/toHavePageTitle';
import { expect as toHaveStyles } from './matchers/toHaveStyles';

import {
	templateRoot,
	SERVER_PORT,
	pagePaths,
	type PageData,
	type GlobalData,
} from '../shared';

import {
	constructServerFilePath,
	type ServerFilePath,
} from '../helpers/server-path';
import { Site } from '../helpers/pages';

interface Fixtures {
	site: Site;
	serverFilePath: ServerFilePath;
}

const createPage = (): PageData => ({
	html: '',
	defaultTitle: '',
});

const globalData: GlobalData = {
	pages: {
		'index.html': createPage(),
		'page-two.html': createPage(),
		'sub-dir/index.html': createPage(),
	},
};

let pagesInit = false;
const initPages = async (browser: Browser) => {
	if (pagesInit) return;

	// parse page data
	await Promise.all(
		pagePaths.map(async (url) => {
			const pageData = globalData.pages[url];

			pageData.html = await fs.promises.readFile(
				path.join(templateRoot, url),
				'utf-8',
			);

			const page = await browser.newPage();
			await page.goto(`http://localhost:${SERVER_PORT}/_template/${url}`);
			pageData.defaultTitle = await page.title();
		}),
	);

	pagesInit = true;
};

export * from '@playwright/test';
export const test = baseTest.extend<Fixtures>({
	site: [
		async ({ browser, page }, use) => {
			await initPages(browser);

			const site = new Site(page, constructServerFilePath(), globalData);
			await use(site);
		},
		{ option: true, scope: 'test' },
	],
	serverFilePath: [
		async ({}, use) => {
			const data = constructServerFilePath();
			await use(data);
		},
		{ option: true, scope: 'test' },
	],
});

export const expect = mergeExpects(toBeReloaded, toHavePageTitle, toHaveStyles);
