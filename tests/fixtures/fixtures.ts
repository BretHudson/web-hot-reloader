import { test as baseTest, mergeExpects } from '@playwright/test';

import { expect as toHaveColor } from './matchers/toHaveColor';
import { expect as toHaveBackgroundColor } from './matchers/toHaveBackgroundColor';
import { expect as toHavePageTitle } from './matchers/toHavePageTitle';
import { expect as toBeReloaded } from './matchers/toBeReloaded';

import {
	constructServerFilePath,
	type ServerFilePath,
} from '../helpers/server-path';
import { Site } from '../helpers/pages';

interface Fixtures {
	site: Site;
	serverFilePath: ServerFilePath;
}

export * from '@playwright/test';
export const test = baseTest.extend<Fixtures>({
	site: [
		async ({ page }, use) => {
			const site = new Site(page, constructServerFilePath());
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

export const expect = mergeExpects(
	toHaveColor,
	toHaveBackgroundColor,
	toHavePageTitle,
	toBeReloaded,
);
