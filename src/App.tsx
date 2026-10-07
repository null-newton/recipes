import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, Check, ChefHat, Clock3, Cloud, CookingPot, ExternalLink, Leaf,
  LoaderCircle, Pencil, Plus, RefreshCw, Search, Settings, Sheet, Trash2,
  UtensilsCrossed, X,
} from "lucide-react";
import {
  checkWriteAccess, createGoogleTokenClient, readRecipes, sheetIdFromUrl, writeRecipes,
  type Recipe, type SheetConfig,
} from "./googleSheets";

type Draft = Omit<Recipe, "id" | "createdAt" | "updatedAt">;
type Notice = { tone: "good" | "bad"; text: string } | null;

const categories = ["All recipes", "Breakfast", "Lunch", "Dinner", "Dessert", "Snacks"];
const blankDraft: Draft = { title: "", category: "Dinner", timeMinutes: 30, ingredients: [""], instructions: [""] };
const defaultConfig: SheetConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  sheetUrl: import.meta.env.VITE_GOOGLE_SHEET_URL ?? "",
  tabName: import.meta.env.VITE_GOOGLE_SHEET_TAB ?? "Recipes",
};
const clientIdPreconfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

function storedConfig(): SheetConfig {
  try {
    const saved = JSON.parse(localStorage.getItem("recipe-sheet-config") ?? "{}");
    return { ...defaultConfig, ...saved, clientId: defaultConfig.clientId || saved.clientId || "" };
  } catch {
    return defaultConfig;
  }
}

function formatTime(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} hr ${minutes % 60} min` : `${hours} hr`;
}

function categoryIcon(category: string) {
  if (category === "Dessert") return <Leaf />;
  if (category === "Snacks") return <UtensilsCrossed />;
  return <CookingPot />;
}

function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true">{children}<button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X /></button></section></div>;
}

function RecipeEditor({ initial, onClose, onSave }: { initial: Recipe | null; onClose: () => void; onSave: (draft: Draft) => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(initial ? {
    title: initial.title, category: initial.category, timeMinutes: initial.timeMinutes,
    ingredients: [...initial.ingredients], instructions: [...initial.instructions],
  } : blankDraft);
  const [saving, setSaving] = useState(false);

  const updateList = (key: "ingredients" | "instructions", index: number, value: string) => {
    setDraft((current) => ({ ...current, [key]: current[key].map((item, i) => i === index ? value : item) }));
  };
  const removeLine = (key: "ingredients" | "instructions", index: number) => {
    setDraft((current) => ({ ...current, [key]: current[key].filter((_, i) => i !== index) }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...draft, title: draft.title.trim(), ingredients: draft.ingredients.map((item) => item.trim()).filter(Boolean), instructions: draft.instructions.map((item) => item.trim()).filter(Boolean) });
      onClose();
    } catch {
      // The parent reports the error. Keep the recipe draft open for retry.
    } finally {
      setSaving(false);
    }
  };

  return <Modal onClose={onClose} wide>
    <form onSubmit={submit}>
      <div className="modal-heading"><h2>{initial ? "Edit recipe" : "Add a recipe"}</h2><p>Keep the essentials together so the recipe is easy to cook again.</p></div>
      <div className="form-grid">
        <label className="field field-full"><span>Recipe name</span><input autoFocus required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Lemon herb pasta" /></label>
        <label className="field"><span>Category</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field"><span>Time needed</span><div className="input-suffix"><input required type="number" min="1" max="1440" value={draft.timeMinutes} onChange={(event) => setDraft({ ...draft, timeMinutes: Number(event.target.value) })} /><em>min</em></div></label>
        <div className="repeat-field field-full">
          <div className="repeat-header"><strong>Ingredients</strong><button type="button" className="text-button" onClick={() => setDraft({ ...draft, ingredients: [...draft.ingredients, ""] })}><Plus /> Add line</button></div>
          {draft.ingredients.map((item, index) => <div className="repeat-row" key={`i-${index}`}><span className="bullet" /><input aria-label={`Ingredient ${index + 1}`} value={item} onChange={(event) => updateList("ingredients", index, event.target.value)} placeholder="2 cloves garlic" />{draft.ingredients.length > 1 && <button type="button" className="icon-button" onClick={() => removeLine("ingredients", index)} aria-label="Remove ingredient"><X /></button>}</div>)}
        </div>
        <div className="repeat-field field-full">
          <div className="repeat-header"><strong>Instructions</strong><button type="button" className="text-button" onClick={() => setDraft({ ...draft, instructions: [...draft.instructions, ""] })}><Plus /> Add step</button></div>
          {draft.instructions.map((item, index) => <div className="repeat-row align-top" key={`s-${index}`}><span className="step-number">{index + 1}</span><textarea aria-label={`Instruction ${index + 1}`} value={item} onChange={(event) => updateList("instructions", index, event.target.value)} placeholder="Describe this step" />{draft.instructions.length > 1 && <button type="button" className="icon-button" onClick={() => removeLine("instructions", index)} aria-label="Remove step"><X /></button>}</div>)}
        </div>
      </div>
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || !draft.title.trim()}>{saving && <LoaderCircle className="spin" />}{initial ? "Save changes" : "Add recipe"}</button></div>
    </form>
  </Modal>;
}

function SettingsModal({ config, onClose, onSave, onConnect, connected, canWrite }: {
  config: SheetConfig; onClose: () => void; onSave: (config: SheetConfig) => void;
  onConnect: (config: SheetConfig) => Promise<void>; connected: boolean; canWrite: boolean;
}) {
  const [next, setNext] = useState(config);
  const [connecting, setConnecting] = useState(false);
  const valid = Boolean(next.clientId.trim() && sheetIdFromUrl(next.sheetUrl) && next.tabName.trim());

  const connect = async () => {
    onSave(next);
    setConnecting(true);
    try { await onConnect(next); onClose(); } catch { /* Keep settings open for correction. */ } finally { setConnecting(false); }
  };

  return <Modal onClose={onClose}>
    <div className="modal-heading"><h2>Google Sheet settings</h2><p>The Sheet is the only recipe database. Its sharing permissions control access.</p></div>
    <div className={`connection-card ${connected ? "is-connected" : ""}`}><Cloud /><div><strong>{connected ? canWrite ? "Connected with edit access" : "Connected with read-only access" : "Connection needed"}</strong><span>{connected ? canWrite ? "Recipe changes are written directly to your Sheet." : "You can view recipes, but this account cannot change the Sheet." : "Add the Sheet link, then authorize Google access."}</span></div></div>
    <div className="settings-fields">
      <label className="field"><span>Shared Google Sheet URL</span><input value={next.sheetUrl} onChange={(event) => setNext({ ...next, sheetUrl: event.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…/edit" /><small>Share the Sheet with each person who should use the library.</small></label>
      {!clientIdPreconfigured && <label className="field advanced-field"><span>Site owner setup: Google OAuth client ID</span><input value={next.clientId} onChange={(event) => setNext({ ...next, clientId: event.target.value })} placeholder="123456789-….apps.googleusercontent.com" /><small>This is configured once by the site owner. Regular visitors only need the Sheet URL.</small></label>}
      <label className="field"><span>Worksheet tab</span><input value={next.tabName} onChange={(event) => setNext({ ...next, tabName: event.target.value })} placeholder="Recipes" /><small>The app creates this tab and its column headings when needed.</small></label>
    </div>
    <div className="modal-actions"><button className="button secondary" onClick={() => { onSave(next); onClose(); }}>Save only</button><button className="button primary" disabled={!valid || connecting} onClick={() => void connect().catch(() => undefined)}>{connecting ? <LoaderCircle className="spin" /> : <Sheet />}Save & connect Google</button></div>
  </Modal>;
}

function RecipeDetail({ recipe, onEdit, canEdit = true }: { recipe: Recipe; onEdit: () => void; canEdit?: boolean }) {
  return <article className="detail-wrap">
    <header className="detail-hero"><div><span className="category-pill">{recipe.category}</span><h2>{recipe.title}</h2><div className="detail-meta"><span><Clock3 />{formatTime(recipe.timeMinutes)}</span><span><UtensilsCrossed />{recipe.ingredients.length} ingredients</span></div></div>{canEdit && <button className="icon-button light" onClick={onEdit} aria-label="Edit recipe"><Pencil /></button>}</header>
    <div className="detail-grid"><section className="detail-card"><h3><span className="section-icon orange"><Leaf /></span>Ingredients</h3><ul>{recipe.ingredients.map((item, index) => <li key={`${item}-${index}`}><Check />{item}</li>)}</ul></section><section className="detail-card"><h3><span className="section-icon blue"><CookingPot /></span>Method</h3><ol>{recipe.instructions.map((item, index) => <li key={`${item}-${index}`}><span className="step-number dark">{index + 1}</span>{item}</li>)}</ol></section></div>
  </article>;
}

export default function App() {
  const [config, setConfig] = useState<SheetConfig>(storedConfig);
  const [token, setToken] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [category, setCategory] = useState("All recipes");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const sheetId = sheetIdFromUrl(config.sheetUrl);
  const configured = Boolean(config.clientId && sheetId && config.tabName);
  const selected = recipes.find((recipe) => recipe.id === selectedId) ?? recipes[0] ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return recipes.filter((recipe) => (category === "All recipes" || recipe.category === category) && (!needle || `${recipe.title} ${recipe.category} ${recipe.ingredients.join(" ")}`.toLowerCase().includes(needle)));
  }, [category, query, recipes]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const saveConfig = (value: SheetConfig) => {
    const clean = { clientId: defaultConfig.clientId || value.clientId.trim(), sheetUrl: value.sheetUrl.trim(), tabName: value.tabName.trim() || "Recipes" };
    if (clean.clientId !== config.clientId || clean.sheetUrl !== config.sheetUrl || clean.tabName !== config.tabName) {
      setToken("");
      setCanWrite(false);
      setRecipes([]);
      setSelectedId("");
    }
    localStorage.setItem("recipe-sheet-config", JSON.stringify(clean));
    setConfig(clean);
  };

  const load = async (accessToken = token, useConfig = config) => {
    const id = sheetIdFromUrl(useConfig.sheetUrl);
    if (!accessToken || !id) return;
    setLoading(true);
    try {
      const rows = await readRecipes(id, useConfig.tabName, accessToken);
      const editable = await checkWriteAccess(id, useConfig.tabName, accessToken);
      setRecipes(rows);
      setCanWrite(editable);
      setSelectedId((current) => rows.some((recipe) => recipe.id === current) ? current : rows[0]?.id ?? "");
      setNotice({ tone: "good", text: editable ? "Sheet connected with edit access" : "Sheet connected in read-only mode" });
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      setCanWrite(false);
      setRecipes([]);
      setSelectedId("");
      if (status === 401) setToken("");
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Could not read the Google Sheet" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const connect = (useConfig = config) => new Promise<void>((resolve, reject) => {
    try {
      const client = createGoogleTokenClient(useConfig.clientId, (response) => {
        if (!response.access_token) { const error = new Error(response.error_description ?? "Google authorization was cancelled"); setNotice({ tone: "bad", text: error.message }); reject(error); return; }
        void load(response.access_token, useConfig).then(() => { setToken(response.access_token!); resolve(); }).catch(reject);
      }, () => {
        const error = new Error("Google authorization was closed or blocked. Allow popups and try again.");
        setNotice({ tone: "bad", text: error.message });
        reject(error);
      });
      client.requestAccessToken({ prompt: token ? "" : "consent" });
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Google authorization is unavailable" });
      reject(error);
    }
  });

  const persist = async (next: Recipe[]) => {
    if (!token) throw new Error("Connect Google before changing recipes");
    if (!canWrite) throw new Error("This Google account only has read access to the Sheet");
    await writeRecipes(sheetId, config.tabName, token, next);
    setRecipes(next);
  };

  const saveRecipe = async (draft: Draft) => {
    if (!draft.ingredients.length || !draft.instructions.length) { setNotice({ tone: "bad", text: "Add at least one ingredient and one instruction" }); throw new Error("Incomplete recipe"); }
    const now = new Date().toISOString();
    const recipe: Recipe = editing ? { ...editing, ...draft, updatedAt: now } : { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    const next = editing ? recipes.map((item) => item.id === recipe.id ? recipe : item) : [recipe, ...recipes];
    try { await persist(next); setSelectedId(recipe.id); setEditing(null); setNotice({ tone: "good", text: editing ? "Recipe updated" : "Recipe added" }); }
    catch (error) { setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Recipe could not be saved" }); throw error; }
  };

  const removeRecipe = async () => {
    if (!deleteTarget) return;
    try { const next = recipes.filter((recipe) => recipe.id !== deleteTarget.id); await persist(next); setSelectedId(next[0]?.id ?? ""); setDeleteTarget(null); setNotice({ tone: "good", text: "Recipe removed" }); }
    catch (error) { setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Recipe could not be removed" }); }
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span><ChefHat /></span><div><strong>Recipe Library</strong><small>Shared through Sheets</small></div></div>
      <nav><p>Browse</p>{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}><span>{item === "All recipes" ? <BookOpen /> : categoryIcon(item)}{item}</span><em>{item === "All recipes" ? recipes.length : recipes.filter((recipe) => recipe.category === item).length}</em></button>)}</nav>
      <div className={`sync-status ${token ? "online" : ""}`}><span /><div><strong>{token ? canWrite ? "Google connected" : "Read-only access" : "Not connected"}</strong><small>{token ? canWrite ? "Sheet is the live database" : "Viewing only" : "Connect to load recipes"}</small></div></div>
      <button className="sidebar-settings" onClick={() => setSettingsOpen(true)}><Settings />Settings</button>
    </aside>

    <section className="recipe-list">
      <header className="list-header"><div><small>Your collection</small><h1>{category}</h1></div><div className="header-actions">{configured && <button className="icon-button mobile-settings" onClick={() => setSettingsOpen(true)} aria-label="Settings"><Settings /></button>}{token ? <button className="button secondary compact" onClick={() => void load().catch(() => undefined)} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />Sync</button> : configured ? <button className="button secondary compact" onClick={() => void connect().catch(() => undefined)}><Cloud />Connect Google</button> : null}<button className="button primary compact" disabled={!token || !canWrite} onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus />Add recipe</button></div></header>

      {!configured && <div className="setup-banner"><div className="setup-icon"><Sheet /></div><div><strong>Connect your shared recipe Sheet</strong><p>Add its link and your Google client ID once. The app will create the Recipes tab automatically.</p></div><button className="button primary" onClick={() => setSettingsOpen(true)}>Open settings</button></div>}
      {configured && !token && <div className="setup-banner compact-banner"><div className="setup-icon"><Cloud /></div><div><strong>Google authorization needed</strong><p>Connect the Google account that has access to the shared Sheet.</p></div><button className="button primary" onClick={() => void connect().catch(() => undefined)}>Connect Google</button></div>}

      <div className="search-box"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes or ingredients" aria-label="Search recipes" /></div>
      <div className="mobile-categories">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="cards">
        {loading && [0, 1, 2].map((item) => <div className="skeleton" key={item} />)}
        {!loading && token && filtered.map((recipe) => <article key={recipe.id} className={selected?.id === recipe.id ? "recipe-card selected" : "recipe-card"} onClick={() => { setSelectedId(recipe.id); setMobileDetail(true); }}><span className="recipe-icon">{categoryIcon(recipe.category)}</span><div className="recipe-summary"><div><h2>{recipe.title}</h2>{canWrite && <><button className="icon-button" onClick={(event) => { event.stopPropagation(); setEditing(recipe); setEditorOpen(true); }} aria-label="Edit recipe"><Pencil /></button><button className="icon-button danger" onClick={(event) => { event.stopPropagation(); setDeleteTarget(recipe); }} aria-label="Remove recipe"><Trash2 /></button></>}</div><p><span><Clock3 />{formatTime(recipe.timeMinutes)}</span><i />{recipe.category}</p><small>{recipe.ingredients.slice(0, 3).join(" · ")}</small></div></article>)}
        {!loading && token && !filtered.length && <div className="empty-state"><img src="./recipe-still-life.png" alt="Fresh herbs, lemon, and tomatoes on a kitchen table" /><div><h2>{recipes.length ? "No recipes match" : "Your first recipe starts here"}</h2><p>{recipes.length ? "Try another search or category." : canWrite ? "Add the ingredients and steps you never want to lose." : "This shared Sheet does not contain recipes yet."}</p>{!recipes.length && canWrite && <button className="button primary" onClick={() => setEditorOpen(true)}><Plus />Add recipe</button>}</div></div>}
      </div>
    </section>

    <section className="recipe-detail">{selected && token ? <RecipeDetail recipe={selected} canEdit={canWrite} onEdit={() => { setEditing(selected); setEditorOpen(true); }} /> : <div className="detail-placeholder"><ChefHat /><h2>{configured ? "Connect Google to open your library" : "Link your shared Sheet"}</h2><p>Your recipe details will appear here.</p></div>}</section>

    {settingsOpen && <SettingsModal config={config} connected={Boolean(token)} canWrite={canWrite} onClose={() => setSettingsOpen(false)} onSave={saveConfig} onConnect={connect} />}
    {editorOpen && <RecipeEditor initial={editing} onClose={() => { setEditorOpen(false); setEditing(null); }} onSave={saveRecipe} />}
    {deleteTarget && <Modal onClose={() => setDeleteTarget(null)}><div className="modal-heading"><h2>Remove {deleteTarget.title}?</h2><p>This deletes the recipe from the shared Google Sheet. This cannot be undone.</p></div><div className="modal-actions"><button className="button secondary" onClick={() => setDeleteTarget(null)}>Keep recipe</button><button className="button destructive" onClick={() => void removeRecipe()}><Trash2 />Remove recipe</button></div></Modal>}
    {mobileDetail && selected && token && <div className="mobile-detail"><div className="mobile-detail-head"><button className="icon-button" onClick={() => setMobileDetail(false)}><X /></button></div><RecipeDetail recipe={selected} canEdit={canWrite} onEdit={() => { setMobileDetail(false); setEditing(selected); setEditorOpen(true); }} /></div>}
    {notice && <div className={`notice ${notice.tone}`}>{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X /></button></div>}
    <a className="sheet-link" href={config.sheetUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!config.sheetUrl}><Sheet />Open Sheet<ExternalLink /></a>
  </main>;
}
