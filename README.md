# Recipe Library on GitHub Pages

A static React + TypeScript + Vite recipe library that uses a shared Google Sheet as its only database.

The website itself can be public. Every visitor connects their own Google account and pastes the URL of a Sheet they can access. Google Sheet sharing permissions determine what they can do:

- **Editor:** view, add, edit, and remove recipes.
- **Viewer:** view and search recipes in read-only mode.
- **No Sheet access:** the library cannot be opened.

The app does not use Supabase, D1, a custom backend, service-account credentials, or a database password.

## How privacy works

The app uses [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/overview) to request a short-lived Google access token. It does not read Google cookies, store Google passwords, or save the access token to `localStorage`.

The browser sends that access token directly to the [Google Sheets API](https://developers.google.com/workspace/sheets/api/guides/values). The app checks both read and write access. The Sheet URL, worksheet name, and public OAuth client ID are stored in the visitor's browser.

## Requirements

- A GitHub account.
- A Google account.
- A Google Cloud project with the Google Sheets API enabled.
- A Google OAuth 2.0 Web application client ID.
- Node.js 22 or newer for local development.

## Reusing this project

Each person deploying their own copy creates their own Google Cloud project and OAuth client, registers their own website origin, and supplies their own `VITE_GOOGLE_CLIENT_ID`. Forks do not inherit the original repository's Actions variables. Regular visitors to a configured deployment do not create OAuth clients: they paste a Sheet URL and authorize their own Google account.

GitHub or Google Drive plugins in ChatGPT/Codex are optional setup helpers. They are not required to run, fork, deploy, or use this application.

This checkout also contains the older Sites application. **Publish the contents of `github-pages/` as the root of a separate GitHub repository.** Its README, package files, `src`, `public`, and `.github` directory must be at that repository's root; publishing the parent checkout would run the wrong application.

## 1. Create the Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Use the project selector at the top to create a new project, for example `Recipe Library`.
3. Make sure the new project is selected before continuing.

## 2. Enable the Google Sheets API

1. In Google Cloud Console, open [**APIs & Services → Library**](https://console.cloud.google.com/apis/library/sheets.googleapis.com).
2. Search for **Google Sheets API**.
3. Open it and select **Enable**.

The app does not need the Google Drive API. It works with Sheet URLs and the Sheets API directly.

## 3. Configure the OAuth consent screen

Open [Google Auth Platform](https://console.cloud.google.com/auth/overview). Google may also show this area as **APIs & Services → OAuth consent screen**.

1. Open the OAuth consent screen setup.
2. Enter an app name such as `Recipe Library`.
3. Select a support email and developer contact email.
4. Choose the audience:
   - **Internal** works only for members of the same Google Workspace organization.
   - **External** supports regular Google accounts and people outside one organization.
5. Add the Google Sheets scope when Google asks for data access:

   ```text
   https://www.googleapis.com/auth/spreadsheets
   ```

6. While the app is in **Testing**, add every Google account that should test it under **Test users**.
7. Save the configuration.

For an external app used beyond its listed test users, publish the consent screen. Google may require verification for broader use of sensitive scopes. Follow the instructions shown in your Google Cloud project.

The `spreadsheets` scope is classified as sensitive. It authorizes reading and editing **all spreadsheets the connected account can access**, even though this app only sends requests for the URL selected in Settings. Entering a URL does not narrow the OAuth scope. Google still enforces that account's sharing permissions on each file. See [Google's scope classifications](https://developers.google.com/workspace/sheets/api/scopes).

For a small personal deployment, use Testing and explicitly add the intended accounts as test users. For a public app accepting arbitrary Google accounts, complete Google's production and verification requirements, including branding, a privacy policy, and domain verification where required. Publishing the GitHub Pages website alone does not make a Testing OAuth client available to everyone.

## 4. Create a Web OAuth client

1. Open [**Google Auth Platform → Clients**](https://console.cloud.google.com/auth/clients), or **APIs & Services → Credentials**.
2. Select **Create client** or **Create credentials → OAuth client ID**.
3. Choose **Web application**.
4. Give it a name such as `Recipe Library Web`.
5. Add the local development origin under **Authorized JavaScript origins**:

   ```text
   http://localhost:5173
   ```

   Google also recommends adding `http://localhost`. If you browse using `127.0.0.1` instead, register that exact origin separately. The local server uses port 5173 and stops if that port is occupied, so the OAuth origin stays predictable.

6. Add the final GitHub Pages origin. For a project site at `https://USERNAME.github.io/recipe-library/`, the origin is only:

   ```text
   https://USERNAME.github.io
   ```

   Do not include `/recipe-library/` in an origin. An origin contains only the protocol and hostname, plus a port when applicable.

7. If you use a custom domain, add its origin too, for example:

   ```text
   https://recipes.example.com
   ```

8. Create the client and copy its value ending in `.apps.googleusercontent.com`.

Leave **Authorized redirect URIs** empty for this app: it uses Google's browser popup token flow and a JavaScript callback. It has no `/callback` server route. Google can take a few minutes to recognize changes to authorized origins.

This client ID is public configuration, not a password. Never add a Google client secret, service-account key, or API secret to this frontend.

## 5. Run the project locally

Clone the repository, then run:

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and set:

```dotenv
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
VITE_GOOGLE_SHEET_URL=
VITE_GOOGLE_SHEET_TAB=Recipes
```

The Sheet URL can remain empty because each visitor can enter their own URL in Settings.

Start the development site:

```bash
npm run dev
```

Open `http://localhost:5173`, open **Settings**, paste a Google Sheet URL, and select **Save & connect Google**.

## 6. Create and share a Google Sheet

1. Create a blank Sheet at [Google Sheets](https://sheets.google.com/).
2. Select **Share**.
3. Add each person who should use it:
   - Give **Editor** access to people who may change recipes.
   - Give **Viewer** access to people who should only read recipes.
4. Copy the Sheet URL.
5. Paste that URL into Recipe Library Settings.

The app creates a worksheet named `Recipes` and adds the expected headings when the connected account has edit access. You can choose a different worksheet name in Settings.

Do not set the Sheet itself to “Anyone with the link can edit” unless you intentionally want unrestricted editing.

## 7. Create the GitHub repository

Create a repository, then place this project's files at the repository root. Commit `package-lock.json`; the deployment workflow uses `npm ci` for reproducible builds.

For this checkout, upload the contents of `github-pages/`, including `.github/workflows/deploy.yml`, rather than uploading the parent Sites project. If uploading through the GitHub website, make sure hidden directories such as `.github` are included. When forking an existing standalone repository, enable Actions on the fork if GitHub asks.

With GitHub Free, Pages normally requires a public repository. Private repository Pages requires an eligible GitHub plan.

## 8. Add the OAuth client ID to GitHub

In the GitHub repository:

1. Open **Settings → Secrets and variables → Actions**.
2. Open the **Variables** tab.
3. Create a repository variable named:

   ```text
   VITE_GOOGLE_CLIENT_ID
   ```

4. Set its value to the Web OAuth client ID created earlier.

For example, in a repository owned by `IsaacSauer` named `recipe-library`, the variables page is `https://github.com/IsaacSauer/recipe-library/settings/variables/actions`. Use your actual owner and repository names.

Use an Actions **variable**, not a secret. The value is included in the browser build and is visible to visitors by design.

## 9. Enable GitHub Pages

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push or merge the project to the `main` branch.
4. Open the **Actions** tab and wait for **Deploy Recipe Library** to finish.
5. Open the Pages URL shown by the completed deployment.

The workflow in `.github/workflows/deploy.yml` builds the app and deploys the `dist` directory automatically on every push to `main`.

If you added or changed the OAuth variable after pushing, open **Actions → Deploy Recipe Library → Run workflow** to build with the new value. The workflow fails with a setup message when the variable is missing or invalid.

## 10. Verify the production site

1. Open the GitHub Pages URL in a private/incognito window.
2. Open **Settings** and paste a shared Sheet URL.
3. Select **Save & connect Google**.
4. Sign in with a Google account that has **Viewer** access and confirm the app reports read-only access.
5. Repeat with an account that has **Editor** access and confirm a recipe can be created, edited, and removed.
6. Open the Sheet and verify the rows match the app.

## Sheet structure

The app manages these columns in the selected worksheet:

| Column | Value |
| --- | --- |
| `id` | Stable recipe UUID |
| `title` | Recipe name |
| `category` | Breakfast, Lunch, Dinner, Dessert, or Snacks |
| `time_minutes` | Preparation/cooking time in minutes |
| `ingredients` | JSON array stored in one cell |
| `instructions` | JSON array stored in one cell |
| `created_at` | ISO timestamp |
| `updated_at` | ISO timestamp |

For this small shared library, the app replaces the recipe rows with a single values update after each change, including blanking removed rows. Avoid editing recipe rows manually while someone is saving from the app. The app refuses to use a worksheet with different headings, so choose an empty tab rather than a tab containing unrelated data. On connection, edit access is tested by writing back the existing header values unchanged.

Access tokens stay in memory. Reloading the page requires reconnecting Google; when a token expires, use **Connect Google** again. The Sheet URL and tab preference are local to each browser and are not shared between visitors.

## Troubleshooting

### `Error 400: origin_mismatch`

The exact site origin is missing from the OAuth client's **Authorized JavaScript origins**. Add `http://localhost:5173` for local development or `https://USERNAME.github.io` for GitHub Pages. Do not add a path.

### Google says the app is blocked or the user is not allowed

If the consent screen is in Testing, add the Google account under **Test users**. Otherwise review the publishing and verification status of the OAuth consent screen.

### A fork asks visitors for a client ID

Set `VITE_GOOGLE_CLIENT_ID` in the fork's own repository variables, then run the deployment workflow again. Variables from the original repository are not copied into forks. Visitors should only need a Sheet URL on a configured deployment.

### Google popup closes or never opens

Allow popups for the deployed site and press **Connect Google** again. Authorization must start from a button click. Browser privacy tools may also block the Google Identity Services script.

### `Google Sheets API has not been used` or `API disabled`

Enable **Google Sheets API** in the same Google Cloud project that owns the OAuth client ID.

### The app reports read-only access

The connected Google account can read the Sheet but cannot update it. Share the Sheet with that exact account as an Editor, then reconnect or press Sync.

### The app cannot find or create the worksheet

Confirm the Sheet URL is correct. An Editor can let the app create the configured worksheet. A Viewer can only open it after an Editor has created it.

### Changes from two people overwrite each other

This app is intended for a small shared recipe collection. Press **Sync** before making changes when multiple people are editing at the same time. A transactional database would be preferable for high-concurrency use.

## Security checklist

- Never commit OAuth client secrets or service-account credentials.
- Keep the OAuth client ID in `.env.local` locally and in the GitHub Actions variable for deployment.
- Share each Sheet only with the people who should access its data.
- Use Viewer access for read-only users and Editor access for people allowed to change recipes.
- Review the OAuth consent screen's test users and publishing status.
- The GitHub Pages website may be public; access to Sheet data is still enforced by Google authorization and Sheet sharing permissions.

## Official references

- [Google Identity Services client setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Google browser token flow](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Sheets API scopes](https://developers.google.com/workspace/sheets/api/scopes)
- [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
