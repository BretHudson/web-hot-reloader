// ==UserScript==
// @name         Web Hot Reloader Injection
// @namespace    http://tampermonkey.net/
// @version      0.4.0
// @description  Hot Web Reloader
// @author       Bret Hudson
// @match        http://brethudson.localhost/*
// @grant        none
// @contributionURL https://github.com/BretHudson/web-hot-reloader
// ==/UserScript==
(function () {
	'use strict';

	const jsSrc = 'http://localhost:3008/reloader.js';
	const scriptElem = document.createElement('script');
	scriptElem.id = '__web-hot-reloader';
	scriptElem.setAttribute('type', 'module');
	scriptElem.src = jsSrc;
	document.head.appendChild(scriptElem);
})();