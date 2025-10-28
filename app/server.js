#!/usr/bin/env node

import { watchForFileChanges } from './index.js';

const [_nodePath, _scriptPath, ...args] = process.argv;
const [watchPath] = args;

watchForFileChanges({ watchPath });
