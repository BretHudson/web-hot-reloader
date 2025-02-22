import { test, expect } from './fixtures/fixtures';
import { describeSerial } from './helpers/describe-serial';
import { pagePaths } from './shared';

const pathWithAliases = pagePaths.map((urlPath) => {
	let aliases: string[] = [];
	if (urlPath.endsWith('index.html')) {
		aliases.push(urlPath.replace('index.html', ''));
	}
	if (urlPath.endsWith('.html')) {
		aliases.push(urlPath.replace('.html', ''));
	}
	aliases.push(urlPath);
	return [urlPath, aliases] as [typeof urlPath, typeof aliases];
});

pathWithAliases.forEach(([urlPath, aliases]) => {
	test.describe(urlPath, () => {
		aliases.forEach((alias) => {
			const aliasTitle = `"/${alias}"`;
			describeSerial(`as ${aliasTitle}`, () => {
				const changes = (updatePath) => (urlPath === updatePath ? '' : 'not ');

				test(`visit ${aliasTitle}, expect default title`, async ({ site }) => {
					site.setPagePathAlias(urlPath, alias);
					await site.goto(urlPath);
					await expect(site).toHaveDefaultPageTitle();
				});

				// const updatePath = 'page-two.html';
				pagePaths.forEach((updatePath) => {
					test(`expect ${updatePath} update to ${changes(
						updatePath,
					)}cause changes`, async ({ site }) => {
						const newTitle = [site.pages[urlPath].currentTitle, 'Updated'].join(
							' | ',
						);
						await site.updateHTML(updatePath, newTitle);
						await expect(site).toHavePageTitle(
							site.pages[urlPath].currentTitle,
						);
					});
				});
			});
		});
	});
});
