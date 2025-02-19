import { expect as baseExpect } from '@playwright/test';

import type { BasePage } from '../../helpers/pages';

export const expect = baseExpect.extend({
	async toHavePageTitle(received: BasePage, expected: string) {
		const _expected = expected ?? received.curTitle;

		const pass = await baseExpect(received.page)
			.toHaveTitle(_expected)
			.then(() => !this.isNot)
			.catch(() => this.isNot);

		return {
			pass,
			message: () => {
				const not = this.isNot ? ' not' : '';
				const hint = this.utils.matcherHint(
					'toHaveTitle',
					undefined,
					undefined,
					{
						isNot: this.isNot,
					},
				);

				return (
					hint +
					'\n\n' +
					`Expected: page to${not} have title ${this.utils.printExpected(
						_expected,
					)}`
				);
			},
		};
	},
});
