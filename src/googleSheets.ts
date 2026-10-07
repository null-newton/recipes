export type Recipe = {
  id: string;
  title: string;
  category: string;
  timeMinutes: number;
  ingredients: string[];
  instructions: string[];
  createdAt: string;
  updatedAt: string;
};

export type SheetConfig = {
  clientId: string;
  sheetUrl: string;
  tabName: string;
};

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const HEADERS = ["id", "title", "category", "time_minutes", "ingredients", "instructions", "created_at", "updated_at"];

export function sheetIdFromUrl(value: string) {
  return value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? "";
}

function escapeTab(tabName: string) {
  return `'${tabName.replaceAll("'", "''")}'`;
}

function authHeaders(token: string, json = false) {
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function apiRequest<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...authHeaders(token, Boolean(init?.body)), ...(init?.headers ?? {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
    const error = new Error(body.error?.message ?? `Google Sheets request failed (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export async function ensureRecipeTab(sheetId: string, tabName: string, token: string) {
  const metadata = await apiRequest<{ sheets?: Array<{ properties?: { title?: string } }> }>(
    `${SHEETS_API}/${sheetId}?fields=sheets.properties.title`, token,
  );
  const exists = metadata.sheets?.some((sheet) => sheet.properties?.title === tabName);
  if (!exists) {
    await apiRequest(`${SHEETS_API}/${sheetId}:batchUpdate`, token, {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tabName } } }] }),
    });
  }
  const headerRange = encodeURIComponent(`${escapeTab(tabName)}!A1:H1`);
  const current = await apiRequest<{ values?: string[][] }>(`${SHEETS_API}/${sheetId}/values/${headerRange}`, token);
  if (!current.values?.length) {
    await apiRequest(`${SHEETS_API}/${sheetId}/values/${headerRange}?valueInputOption=RAW`, token, {
      method: "PUT",
      body: JSON.stringify({ range: `${escapeTab(tabName)}!A1:H1`, majorDimension: "ROWS", values: [HEADERS] }),
    });
  } else if (HEADERS.some((header, index) => current.values?.[0]?.[index] !== header)) {
    throw new Error(`The ${tabName} tab contains different columns. Choose a new, empty tab in Settings.`);
  }
}

export async function readRecipes(sheetId: string, tabName: string, token: string): Promise<Recipe[]> {
  await ensureRecipeTab(sheetId, tabName, token);
  const range = encodeURIComponent(`${escapeTab(tabName)}!A2:H`);
  const data = await apiRequest<{ values?: Array<Array<string | number>> }>(`${SHEETS_API}/${sheetId}/values/${range}`, token);
  return (data.values ?? []).filter((row) => row[0] && row[1]).map((row) => ({
    id: String(row[0]),
    title: String(row[1]),
    category: String(row[2] || "Dinner"),
    timeMinutes: Number(row[3]) || 1,
    ingredients: parseList(row[4]),
    instructions: parseList(row[5]),
    createdAt: String(row[6] || ""),
    updatedAt: String(row[7] || ""),
  })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function checkWriteAccess(sheetId: string, tabName: string, token: string) {
  const range = encodeURIComponent(`${escapeTab(tabName)}!A1:H1`);
  const current = await apiRequest<{ values?: string[][] }>(`${SHEETS_API}/${sheetId}/values/${range}`, token);
  // Check editing permission by submitting the exact existing header values.
  try {
    await apiRequest(`${SHEETS_API}/${sheetId}/values/${range}?valueInputOption=RAW`, token, {
      method: "PUT",
      body: JSON.stringify({
        range: `${escapeTab(tabName)}!A1:H1`,
        majorDimension: "ROWS",
        values: current.values ?? [HEADERS],
      }),
    });
    return true;
  } catch (error) {
    if ((error as Error & { status?: number }).status === 403) return false;
    throw error;
  }
}

function parseList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return value.split("\n").map((item) => item.trim()).filter(Boolean);
  }
}

export async function writeRecipes(sheetId: string, tabName: string, token: string, recipes: Recipe[]) {
  await ensureRecipeTab(sheetId, tabName, token);
  const existingRange = encodeURIComponent(`${escapeTab(tabName)}!A2:H`);
  const previous = await apiRequest<{ values?: unknown[][] }>(`${SHEETS_API}/${sheetId}/values/${existingRange}`, token);
  const rowCount = Math.max(recipes.length, previous.values?.length ?? 0);
  if (!rowCount) return;
  const range = encodeURIComponent(`${escapeTab(tabName)}!A2:H${rowCount + 1}`);
  const values = recipes.map((recipe) => [
    recipe.id,
    recipe.title,
    recipe.category,
    recipe.timeMinutes,
    JSON.stringify(recipe.ingredients),
    JSON.stringify(recipe.instructions),
    recipe.createdAt,
    recipe.updatedAt,
  ]);
  // Blank removed rows in the same write, so a failed save never first clears the library.
  while (values.length < rowCount) values.push(Array.from({ length: HEADERS.length }, () => ""));
  await apiRequest(`${SHEETS_API}/${sheetId}/values/${range}?valueInputOption=RAW`, token, {
    method: "PUT",
    body: JSON.stringify({ majorDimension: "ROWS", values }),
  });
}

export function createGoogleTokenClient(clientId: string, callback: (response: GoogleTokenResponse) => void, onError?: (error: unknown) => void) {
  if (!window.google?.accounts.oauth2) throw new Error("Google authorization is still loading. Try again in a moment.");
  return window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    callback,
    error_callback: onError,
  });
}
