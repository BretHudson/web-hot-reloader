export const camelCaseToKebabCase = (s: string) =>
	s.replaceAll(/[A-Z]/g, (a) => `-${a.toLowerCase()}`);
export const kebabCaseToCamelCase = (s: string) =>
	s.replaceAll(/\-([a-z])/g, (_, a) => a.toUpperCase());
