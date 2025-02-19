import { test as baseTest, mergeExpects } from '@playwright/test';

import {
	constructServerFilePath,
	type ServerFilePath,
} from '../helpers/server-path';
import { expect as toHaveColor } from './toHaveColor';
import { expect as toHaveBackgroundColor } from './toHaveBackgroundColor';
import { expect as toHaveTitle } from './toHaveTitle';
import { expect as toBeReloaded } from './toBeReloaded';

export interface Fixtures {
	serverFilePath: ServerFilePath;
}

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

export const expect = mergeExpects(
	toHaveColor,
	toHaveBackgroundColor,
	toHaveTitle,
	toBeReloaded,
);
