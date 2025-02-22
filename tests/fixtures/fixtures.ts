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
	SitePagePath,
} from '../shared';

import {
	constructServerFilePath,
	type ServerFilePath,
} from '../helpers/server-path';
import { Site } from '../helpers/pages';

interface Fixtures {
	globalData: GlobalData;
	site: Site;
	serverFilePath: ServerFilePath;
}

const createPage = (urlPath: SitePagePath): [SitePagePath, PageData] => [
	urlPath,
	{
		urlPath,
		html: '',
		defaultTitle: '',
	},
];

const _globalData: GlobalData = {
	pages: Object.fromEntries([
		createPage('index.html'),
		createPage('page-two.html'),
		createPage('sub-dir/index.html'),
	]) as GlobalData['pages'],
};

let pagesInit = false;
const initPages = async (browser: Browser) => {
	if (pagesInit) return;

	// parse page data
	await Promise.all(
		pagePaths.map(async (url) => {
			const pageData = _globalData.pages[url];

			pageData.html = await fs.promises.readFile(
				path.join(templateRoot, url),
				'utf-8',
			);

			const page = await browser.newPage();
			await page.goto('../_template/' + url);
			pageData.defaultTitle = await page.title();
		}),
	);

	pagesInit = true;
};

export * from '@playwright/test';
export const test = baseTest.extend<Fixtures>({
	globalData: [
		async ({ browser }, use) => {
			await initPages(browser);
			await use(_globalData);
		},
		{ option: true, scope: 'test' },
	],
	site: [
		async ({ page, globalData }, use) => {
			// TODO(bret): deep clone the globalData?
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
