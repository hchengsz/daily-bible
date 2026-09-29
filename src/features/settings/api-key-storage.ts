// Web keys live only in memory and disappear when the page is refreshed.
let sessionKeys: string | null = null;
export const readApiKeys = async () => sessionKeys;
export const writeApiKeys = async (value: string | null) => { sessionKeys = value; };
