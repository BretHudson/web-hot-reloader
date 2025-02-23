const _origin = window.location.port
	? window.location.origin.replace(`:${window.location.port}`, '')
	: window.location.origin;
const origin = `${_origin}:${3008}`;

const SCRIPT_ID = '__web-hot-reloader';

const log = console.log.bind(this, '[WHR]');
const warn = console.warn.bind(this, '[WHR]');
const error = console.error.bind(this, '[WHR]');

// NOTE(bret): It will always be /?_whr=[..]$/ or /&_whr=[..]$/
const queryKey = '_whr';

let self = document.getElementById(SCRIPT_ID);
window.addEventListener('DOMContentLoaded', () => {
	self = document.getElementById(SCRIPT_ID);
});
const getOrigin = () => self.getAttribute('data-origin');

const removeAllQueryStrings = (url) => url.split('?')[0];
const removeCacheBust = (url) => {
	const [path, queryString] = url.split('?');
	const params = new URLSearchParams(queryString);
	params.delete(queryKey);
	return [path, params].join('?');
};
const addCacheBust = (url) => {
	const [path, queryString] = url.split('?');
	const params = new URLSearchParams(queryString);
	params.set(queryKey, Date.now().toString(36));
	return [path, params].join('?');
};

const getUrlAttr = (elem) => (elem['src'] ? 'src' : 'href');

/// NOTE(bret): there is a difference between accessing via square brackets & getAttribute()
// For example, given <img src="logo.svg" />
// - link.src/link['src'] will return the computed property, ie "http://localhost/logo.svg"
// - link.getAttribute('src') will return "logo.svg"
const updateElems = (fileName) => {
	const elems = [...document.querySelectorAll('[href],[src]')].filter(
		(link) => {
			const attr = getUrlAttr(link);
			if (!link.getAttribute(attr)) return;
			// TODO(bret): this check isn't robust, esp once we add srcset support (and '../' could screw it up!)
			return removeAllQueryStrings(link[attr]).endsWith(fileName);
		},
	);

	elems.forEach((elem) => {
		const attr = getUrlAttr(elem);
		const value = addCacheBust(elem.getAttribute(attr));
		elem.setAttribute(attr, value);
		log(`Reloaded "${removeCacheBust(value)}"`);
	});
};

const updateAsset = updateElems;

const updateHTML = (_contents) => {
	let contents = _contents;

	const script = document.getElementById('__web-hot-reloader');

	// TODO(bret): Revisit this - string replacement is highly dependent on how the incoming HTML file is formatted :/
	['src', 'href'].forEach((attr) => {
		const elems = [...document.querySelectorAll(`[${attr}*="${queryKey}="]`)];
		elems.forEach((elem) => {
			const link = elem.getAttribute(attr);
			const filePath = removeCacheBust(link);
			contents = contents.replaceAll(`"${filePath}"`, `"${link}"`);
		});
	});

	document.open();
	document.write(contents);
	document.close();

	document.getElementById('__web-hot-reloader')?.remove();
	document.head.append(script);

	log('reloaded page');
};

const reloadSelf = () => {
	const fileName = removeAllQueryStrings(import.meta.url);
	warn(`Swapped ${fileName}`);
	const newScript = document.createElement('script');
	for (const attr of self.attributes) {
		if (attr.name === 'src') continue;
		newScript.setAttribute(attr.name, attr.value);
	}
	newScript.src = addCacheBust(fileName);
	self.after(newScript);
	self.remove();
};

let lastJsUpdate = null;
const initWebSocket = async () => {
	const observer = new PerformanceObserver((list) => {
		const entries = list.getEntries();
		entries.forEach((entry) => {
			switch (entry.initiatorType) {
				case 'link':
				case 'other':
				case 'img':
					break;
				default:
					return;
			}
			const room = entry.name.replace(window.location.origin + '/', '');
			const data = JSON.stringify({ room });
			socket.emit('watch-asset', data);
		});
	});
	observer.observe({ type: 'resource', buffered: true });

	const socket = io(origin, {
		query: {
			origin: window.location.origin,
			pathName: window.location.pathname,
		},
	});
	window['__whr-socket'] = socket;

	socket.on('connect', () => {
		log('Socket connected');
	});

	socket.on('html-update', (data) => {
		const { contents } = data;
		updateHTML(contents);
	});

	socket.on('asset-update', (data) => {
		const { fileName } = data;
		updateAsset(fileName);
	});

	socket.on('reload-self', (data) => {
		if (lastJsUpdate && lastJsUpdate !== data.lastJsUpdate) {
			log('Shutting down reloader, about to disconnect');
			socket.close();
			reloadSelf();
		}
		({ lastJsUpdate } = data);
	});

	socket.on('disconnect', () => {
		log('Socket disconnected');

		observer.disconnect();
	});

	log('Socket initialized');
};

const init = () => {
	const scriptSrc = `${origin}/socket.io/socket.io.js`;
	const scriptElem = document.createElement('script');
	scriptElem.onload = () => {
		window.requestAnimationFrame(async () => {
			await initWebSocket();
		});
	};
	scriptElem.src = scriptSrc;
	document.head.append(scriptElem);

	log('Reloader initialized');
};

init();
