import { expect as baseExpect } from '@playwright/test';

import type { WHRLocator } from '../../helpers/pages';

export const expect = baseExpect.extend({
	async WHR_toNotBeReloaded(received: WHRLocator) {
		const { locator, attr } = received;
		try {
			await locator.waitFor({ state: 'attached' });
		} catch (e) {
			return {
				message: () => 'element not on page',
				pass: false,
			};
		}
		const link = await locator.getAttribute(attr);
		if (!link) {
			return {
				message: () => `attribute "${attr}" not present on element`,
				pass: false,
			};
		}
		const pass = !link.includes('?');
		return {
			message: () => (pass ? 'passed' : `element has already been reloaded`),
			pass,
		};
	},

	async WHR_toBeReloaded(received: WHRLocator) {
		const { page, locator, attr } = received;
		try {
			await locator.waitFor({ state: 'attached', timeout: 3e3 });
		} catch (e) {
			return {
				message: () => 'element not on page',
				pass: false,
			};
		}
		try {
			const handle = await locator.elementHandle();

			const good = await page.waitForFunction(
				({ el, attr }) => el?.getAttribute(attr)?.includes('?'),
				{ el: handle, attr },
				{ timeout: 10e3 },
			);

			return {
				message: () => 'passed',
				pass: Boolean(good),
			};
		} catch (e) {
			return {
				message: () => 'element has not been reloaded via WHR',
				pass: false,
			};
		}
	},
});
