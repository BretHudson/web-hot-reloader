#!/usr/bin/env node

import { PORT } from './constants.js';
import { WebHotReloader } from './index.js';

const [_nodePath, _scriptPath, ...args] = process.argv;
const [watchPath] = args;

const options = { watchPath, port: PORT };
new WebHotReloader(options).start();
