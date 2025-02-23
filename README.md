# Web Hot Reloader

Automatically reload your HTML, CSS, and image resources within the browsre in real-time, without having to add a single line of code to your project's codebase.

- 🪶 Lightweight
- 🌻 Works with vanilla JS
- ⚙️ Completely standalone application
- 🚫 No reliance on build tools or post-processors
- 🚫 No need to remove from production releases - it was never there in the first place!

## Motivation

Frameworks like [React](https://github.com/facebook/react) have spoiled us with features like HMR (hot module reload), reducing developer friction when making small, incremental changes. Wouldn't it be nice to have a lightweight solution for vanilla JS projects, without having to use a framework?

And so, Web Hot Reloader was born. It consists of two parts: a Node.js process that watches to a directory for file changes, and a script to inject WebSocket code into your web page.

## Setup

For this example, we're going to enable hot reloading for my website, which is, on my system, located at `C:\xampp\apps\brethudson`.

Prerequisites:

- [Node.js](https://nodejs.org/en/download)
- Clone the repo

Ensure `node_modules` are installed with `pnpm i` (`npm i` will also work, but will generate a `package-lock.json` file)

### Running the program

To initialize the hot reloader for this project, we can type the following:

```cmd
node app C:\xampp\app\brethudson
```

Tip: You can override `PORT` (default `3008`) and `NODE_ENV` (default `production`) in your environment variables.

### Getting your browser to listen

(Coming soon: built-in proxy server)

Now, while you _could_ copy/paste [public/reloader.js](public/reloader.js) into your project and include it in every page that you want to use it on, that doesn't scale well, and also means that you would need to ensure it gets removed in the production/live site.

What I suggest is grabbing a browser extension such as [Tampermonkey](https://www.tampermonkey.net/), which will allow us to run scripts on certain pages!

[Click to Install UserScript](https://raw.githubusercontent.com/BretHudson/web-hot-reloader/refs/heads/main/misc/reload-tampermonkey.user.js) ([Source Code](https://github.com/BretHudson/web-hot-reloader/blob/main/misc/reload-tampermonkey.user.js))

Within this file, every `@match` line will correspond to a URL path to match. For me, my project loads at `brethudson.localhost`. You can add as many of these as you want! In fact, I add a new line for each project. You could also match `https://localhost*` to capture all `localhost` activity to enable the hot reloading on all projects served on your computer.

## Current limitations

- Only HTML, CSS, and image files are supported
- ~~No recursive folder watching~~
- JS support is not currently on the roadmap
- No automatic script injection

## Future plans

There really aren't any specific ones! Some things I would like to add:

- [x] ~~Recursive listening (`C:/project/css` would be able to listen to `C:/project/css/sub-folder` as well - meaning it would be possible to just use `C:/project` as the directory)~~
- [x] ~~HTML reloading support~~
- [x] ~~`<img>`/favicon reloading support~~
- [ ] Proxy server with hot reloader injection magic
- [ ] Project configuration files (`reloader.json` or `reloader.config.js`)
- [ ] Publish to `npm`
- [ ] JS support (maybe?)
