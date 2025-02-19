import { expect as baseExpect } from '@playwright/test';

import { testSelectorPropertyMatch } from '../../helpers/test-selector';
import type { BasePage } from '../../helpers/pages';

export const expect = baseExpect.extend({
	async toHaveColor(received: BasePage, expected: string) {
		const { page } = received;
		return testSelectorPropertyMatch(page, 'body', 'color', expected);
	},
});
