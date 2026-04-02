## 📁 What This Folder Does

Express app layer for TaskFlow: boots the server (`index.js`), auth JWT flows, task CRUD, user profile handlers, plus shared response helpers (`utils.js`) and Jest tests under `__tests__/`.

## 📄 Files Overview

- **`index.js`** — Express entry (middleware, routes, `/health`, Mongoose connect). _Source: `src/index.js`._
- **`auth.js`** — `register` / `login` using JWT, bcrypt, `formatResponse`, `validateEmail`; requires `./models/User`. _Source: `src/auth.js`._
- **`tasks.js`** — task CRUD handlers; requires `./utils`, `./models/Task`. _Source: `src/tasks.js`._
- **`users.js`** — profile CRUD handlers; requires `./utils`, `./auth` (login import), `./models/User`. _Source: `src/users.js`._
- **`utils.js`** — `formatResponse`, `validateEmail`, helpers; **no `//` comments**. _Source: `src/utils.js`._
- **`__tests__/auth.test.js`** — only Jest file in tree today. _Source: listing._

## 🔗 How Files Connect

`index.js` loads `auth`, `tasks`, `users` and mounts them under `/api/*`. **`auth.js`**, **`tasks.js`**, and **`users.js`** all **`require('./utils')`**. Auth/users need **`User`** model; tasks need **`Task`** model — **Confidence: High** (_see require lines in each file_).

## ⚠️ Watch Out For

- **`src/models/` is not in this demo tree**, yet `require('./models/User')` and `require('./models/Task')` appear — app will not start until those modules exist or requires change. _Sources: `auth.js:5`, `tasks.js:2`, `users.js:3`._
- **`utils.js`** and **`users.js`** use **zero** `//` line comments (per grep). **`index.js`** mounts route modules that are not Express `Router` exports as wired — verify before running. _Sources: `src/index.js` `app.use`, `src/auth.js` exports._

## 👤 Ownership

From **`git log`** / **`git shortlog`**: **`src/utils.js`** Alex Chen (`e66aa8f`); **`src/auth.js`** & **`src/__tests__/auth.test.js`** Sara Kim; **`src/index.js`** Alex; **`src/tasks.js`** Alex; **`src/users.js`** Sara. Mixed follow-up commits on auth/index — see root `MIND.md` for hashes. **Confidence: High** for attributions from git history.
