/* Where the two halves live. On rentnode.org the console is app.rentnode.org;
   on vercel.app and localhost both fall back to paths on the same host. */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "/app";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "/";
export const DOCS_URL = `${SITE_URL.replace(/\/$/, "")}/docs`;
export const GITHUB_URL = "https://github.com/rentnodeapp/rentnode";
/** RNODE - Rentnode token, 18 decimals, 1,000,000,000 supply. The only one. */
export const TOKEN = "0x954f81c9bdce955619e8533bc5fdd9d0503cf8b4";
