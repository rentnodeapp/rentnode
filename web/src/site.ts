/* Where the two halves live. On rentnode.org the console is app.rentnode.org;
   on vercel.app and localhost both fall back to paths on the same host. */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "/app";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "/";
export const DOCS_URL = `${SITE_URL.replace(/\/$/, "")}/docs`;
export const GITHUB_URL = "https://github.com/rentnodeapp/rentnode";
