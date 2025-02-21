import {
	expect as baseExpect,
	type ExpectMatcherState,
	type Page,
} from '@playwright/test';

import type { BasePage, Site } from '../../helpers/pages';

const expectTitle = async (
	test: ExpectMatcherState,
	page: Page,
	expected: string,
) => {
	let message;
	const pass = await baseExpect(page)
		.toHaveTitle(expected)
		.then(() => !test.isNot)
		.catch((e) => {
			message = e.message;
			return test.isNot;
		});

	return {
		pass,
		message: () => {
			const not = test.isNot ? ' not' : '';
			const hint = test.utils.matcherHint('toHaveTitle', undefined, undefined, {
				isNot: test.isNot,
			});

			return hint + '\n\n' + message;
		},
	};
};

export const expect = baseExpect.extend({
	async toHavePageTitle(received: BasePage, expected: string) {
		const _expected = expected ?? received.curTitle;
		return expectTitle(this, received.page, _expected);
	},

	async toHavePageTitle_Site(received: Site, expected: string) {
		return expectTitle(this, received.page, expected);
	},

	async toHaveDefaultPageTitle(received: Site) {
		const site = received;
		const title = site.globalData.pages[site.currentPage].defaultTitle;
		return expectTitle(this, site.page, title);
	},
});
