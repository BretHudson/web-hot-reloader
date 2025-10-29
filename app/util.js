import url from 'node:url';

export const getDirname = (meta) => url.fileURLToPath(new URL('.', meta.url));
