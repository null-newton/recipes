# Setup for null-newton/recipes

This is the checklist for your deployment. For anyone deploying their own fork, use [README.md](README.md).

## Google Cloud

1. [Create or select a Google Cloud project](https://console.cloud.google.com/projectcreate).
2. [Enable Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com) in that project.
3. [Configure Google Auth Platform](https://console.cloud.google.com/auth/overview): enter the application name and contact email, choose **External** for personal Google accounts, and add your email as a **Test user** while the app is in Testing.
4. In Data Access, add `https://www.googleapis.com/auth/spreadsheets`.
5. [Create an OAuth client](https://console.cloud.google.com/auth/clients) of type **Web application**.
6. Add these **Authorized JavaScript origins**:

   ```text
   http://localhost
   http://localhost:5173
   https://null-newton.github.io
   ```

   The GitHub origin has no `/recipes/` path. Leave redirect URIs empty for the browser popup flow used here.
7. Copy the public client ID ending in `.apps.googleusercontent.com`. No client secret is needed.

## GitHub

1. Sign in to GitHub as **null-newton**. The CLI was authenticated as **IsaacSauer** when this guide was prepared; it needs the target account or explicit repository access before it can publish.
2. [Create a repository](https://github.com/new) named `recipes` under `null-newton`. GitHub Free Pages requires a public repository.
3. Push the **contents** of this `github-pages/` directory to the repository root, including `.github/workflows/deploy.yml` and `package-lock.json`.
4. [Add a repository Actions variable](https://github.com/null-newton/recipes/settings/variables/actions) named `VITE_GOOGLE_CLIENT_ID`. Paste your public client ID as its value.
5. [Open Pages settings](https://github.com/null-newton/recipes/settings/pages) and set Source to **GitHub Actions**.
6. [Run Deploy Recipe Library](https://github.com/null-newton/recipes/actions) on `main`. The deployment must build after the variable is saved.
7. When the workflow succeeds, the expected website address is `https://null-newton.github.io/recipes/`.

## Use the app

Create a Google Sheet, share it with intended users, and paste its URL into the app's Settings. Every visitor connects their own Google account. Editors can change recipes; viewers can read an already initialized recipe tab.

The client ID is configured once for the whole deployment. Visitors do not need a Google Cloud project. The OAuth client's Testing status limits connection to its listed test users; complete Google's publishing and verification process before opening OAuth access to arbitrary accounts.
