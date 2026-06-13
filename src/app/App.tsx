import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Moon, Sun, ChevronLeft, ChevronRight, AlignLeft, Hash, Pin, MoreHorizontal, Palette } from "lucide-react";

interface Page {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ThemeMode = "light" | "dark" | "custom";

function createPage(content = "", title = ""): Page {
  const now = new Date();
  return { id: crypto.randomUUID(), title, content, pinned: false, createdAt: now, updatedAt: now };
}

function getTitle(page: Page): string {
  if (page.title) return page.title;
  const firstLine = page.content.split("\n")[0]?.trim();
  return firstLine || "Untitled";
}

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function charCount(text: string): number {
  return text.length;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const STORAGE_KEY = "blankpage_data";

function loadData(): { pages: Page[]; activeId: string | null; themeMode: ThemeMode; customBg: string; customFg: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { pages: [], activeId: null, themeMode: "light", customBg: "#2d4a3e", customFg: "#c8e6c9" };
    const parsed = JSON.parse(raw);
    return {
      pages: parsed.pages.map((p: Page) => ({
        ...p,
        pinned: p.pinned ?? false,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      })),
      activeId: parsed.activeId,
      themeMode: parsed.themeMode ?? "light",
      customBg: parsed.customBg ?? "#2d4a3e",
      customFg: parsed.customFg ?? "#c8e6c9",
    };
  } catch {
    return { pages: [], activeId: null, themeMode: "light", customBg: "#2d4a3e", customFg: "#c8e6c9" };
  }
}

function NameModal({ dark, onConfirm, onCancel, label = "Page name" }: {
  dark: boolean; onConfirm: (name: string) => void; onCancel: () => void; label?: string;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const bg = dark ? "#1a1a18" : "#ffffff";
  const fg = dark ? "#e0e0dc" : "#1a1a18";
  const muted = dark ? "#4a4a45" : "#b0b0b0";
  const border = dark ? "#2e2e2a" : "#e0e0dc";
  const inputBg = dark ? "#111110" : "#f5f5f3";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onCancel}>
      <div className="flex flex-col gap-4 rounded-xl p-5" style={{ background: bg, border: `1px solid ${border}`, width: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }} onClick={(e) => e.stopPropagation()}>
        <span style={{ fontSize: 14, color: fg }}>{label}</span>
        <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onConfirm(value.trim()); if (e.key === "Escape") onCancel(); }}
          placeholder="Untitled" className="rounded-lg px-3 outline-none"
          style={{ height: 36, background: inputBg, border: `1px solid ${border}`, color: fg, fontSize: 14 }} />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="rounded-lg px-4" style={{ height: 32, fontSize: 13, color: muted, background: "transparent", border: `1px solid ${border}` }}>Cancel</button>
          <button onClick={() => onConfirm(value.trim())} className="rounded-lg px-4" style={{ height: 32, fontSize: 13, color: dark ? "#111110" : "#fff", background: dark ? "#e0e0dc" : "#1a1a18" }}>Create</button>
        </div>
      </div>
    </div>
  );
}

function PageMenu({ dark, pinned, onPin, onRename, onDelete, onClose, anchorRect }: {
  dark: boolean; pinned: boolean; onPin: () => void; onRename: () => void; onDelete: () => void; onClose: () => void; anchorRect: DOMRect;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const bg = dark ? "#1e1e1b" : "#ffffff";
  const fg = dark ? "#e0e0dc" : "#1a1a18";
  const border = dark ? "#2e2e2a" : "#e0e0dc";
  const hoverBg = dark ? "#2a2a27" : "#f0f0ee";
  useEffect(() => {
    const handle = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);
  const top = anchorRect.bottom + 4;
  const left = anchorRect.right - 150;
  const item = (label: string, onClick: () => void, red = false) => (
    <button key={label} className="w-full text-left px-3 rounded-lg transition-colors"
      style={{ height: 34, fontSize: 13, color: red ? "#e05252" : fg, background: "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      onClick={() => { onClick(); onClose(); }}>
      {label}
    </button>
  );
  return (
    <div ref={menuRef} className="fixed z-50 flex flex-col p-1 rounded-xl"
      style={{ top, left, width: 150, background: bg, border: `1px solid ${border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.16)" }}>
      {item(pinned ? "Unpin" : "Pin", onPin)}
      {item("Rename", onRename)}
      {item("Delete", onDelete, true)}
    </div>
  );
}

function ThemeDropdown({ themeMode, customBg, customFg, hoverBg, muted, borderColor, onLight, onDark, onCustom, onClear }: {
  themeMode: ThemeMode; customBg: string; customFg: string;
  hoverBg: string; muted: string; borderColor: string;
  onLight: () => void; onDark: () => void;
  onCustom: (bg: string, fgColor: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [localBg, setLocalBg] = useState(customBg);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Always-white/always-dark panel bg — independent of current theme
  const dropBg = "#ffffff";
  const dropBorder = "#e0e0dc";

  const handleClose = useCallback(() => {
    onCustom(localBg, customFg);
    setOpen(false);
  }, [localBg, customFg, onCustom]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handleClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, handleClose]);

  const triggerIcon = themeMode === "light" ? <Sun size={14} /> : themeMode === "dark" ? <Moon size={14} /> : <Palette size={14} />;

  // Fixed styles for light/dark buttons so they never change with theme
  const lightBtnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 6,
    border: themeMode === "light" ? "1.5px solid #aaaaaa" : "1px solid #e0e0dc",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#ffffff", cursor: "pointer", color: "#888888", flexShrink: 0,
  };

  const darkBtnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 6,
    border: themeMode === "dark" ? "1.5px solid #777770" : "1px solid #333330",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#111110", cursor: "pointer", color: "#777770", flexShrink: 0,
  };

  const customBtnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 6,
    border: themeMode === "custom" ? "1.5px solid #aaaaaa" : "1px solid #e0e0dc",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: localBg, cursor: "pointer", flexShrink: 0, overflow: "hidden",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded transition-colors"
        style={{ width: 30, height: 30, color: muted }}
        onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {triggerIcon}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 flex flex-col items-center gap-2 p-2"
          style={{
            background: dropBg,
            border: `1px solid ${dropBorder}`,
            borderRadius: 10,
            boxShadow: "0 6px 20px rgba(0,0,0,0.13)",
          }}
        >
          {/* Light — always white */}
          <button style={lightBtnStyle} onClick={() => { onLight(); setOpen(false); }} title="Light">
            <Sun size={13} />
          </button>

          {/* Dark — always dark */}
          <button style={darkBtnStyle} onClick={() => { onDark(); setOpen(false); }} title="Dark">
            <Moon size={13} />
          </button>

          {/* Custom BG swatch */}
          <button
            style={customBtnStyle}
            onClick={() => colorInputRef.current?.click()}
            title="Custom color"
          />
          <input
            ref={colorInputRef}
            type="color"
            value={localBg}
            onChange={(e) => { setLocalBg(e.target.value); onCustom(e.target.value, customFg); }}
            style={{ width: 0, height: 0, opacity: 0, position: "absolute", pointerEvents: "none" }}
          />

          {/* Clear */}
          <button
            onClick={() => { onClear(); setOpen(false); }}
            style={{
              width: 32, height: 32, borderRadius: 6, border: `1px solid #e05252`,
              fontSize: 10, color: "#e05252", background: "transparent",
              cursor: "pointer", letterSpacing: "0.03em",
            }}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const saved = loadData();
  const initialPages = saved.pages.length > 0 ? saved.pages : [createPage("Welcome to blank.page\n\nA quiet place to write. No formatting bars, no distractions — just you and the page.", "Welcome")];
  const initialActiveId = saved.activeId ?? initialPages[0].id;

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [activeId, setActiveId] = useState<string>(initialActiveId);
  const [themeMode, setThemeMode] = useState<ThemeMode>(saved.themeMode);
  const [customBg, setCustomBg] = useState(saved.customBg);
  const [customFg, setCustomFg] = useState(saved.customFg);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState<"idle" | "saving" | "saved">("idle");
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [showNewModal, setShowNewModal] = useState(false);
  const [menuState, setMenuState] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dark = themeMode === "dark";
  const sortedPages = [...pages.filter((p) => p.pinned), ...pages.filter((p) => !p.pinned)];
  const activePage = pages.find((p) => p.id === activeId) ?? pages[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pages, activeId, themeMode, customBg, customFg }));
  }, [pages, activeId, themeMode, customBg, customFg]);

  useEffect(() => { setTimeout(() => textareaRef.current?.focus(), 50); }, [activeId]);

  useEffect(() => {
    if (inlineEditId) setTimeout(() => { inlineInputRef.current?.focus(); inlineInputRef.current?.select(); }, 30);
  }, [inlineEditId]);

  useEffect(() => {
    if (focusMode) {
      setFocusSeconds(0);
      focusIntervalRef.current = setInterval(() => setFocusSeconds((s) => s + 1), 1000);
    } else {
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
    }
    return () => { if (focusIntervalRef.current) clearInterval(focusIntervalRef.current); };
  }, [focusMode]);

  const handleContentChange = useCallback((value: string) => {
    setPages((prev) => prev.map((p) => p.id === activeId ? { ...p, content: value, updatedAt: new Date() } : p));
    setSaveIndicator("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveIndicator("saved"), 800);
  }, [activeId]);

  const addPage = (name: string) => {
    const page = createPage("", name || "Untitled");
    setPages((prev) => [page, ...prev.filter((p) => !p.pinned), ...prev.filter((p) => p.pinned)]);
    setActiveId(page.id);
  };

  const deletePage = (id: string) => {
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (next.length === 0) { const fresh = createPage("", "Untitled"); setActiveId(fresh.id); return [fresh]; }
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  };

  const pinPage = (id: string) => setPages((prev) => prev.map((p) => p.id === id ? { ...p, pinned: !p.pinned } : p));

  const downloadPdf = (id: string) => {
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    const title = getTitle(page);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body { font-family: Georgia, serif; font-size: 18px; line-height: 1.85; max-width: 680px; margin: 60px auto; color: #1a1a18; white-space: pre-wrap; }
      h1 { font-size: 22px; margin-bottom: 24px; }
    </style></head><body><h1>${title}</h1>${page.content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const commitRename = (id: string) => {
    const val = inlineEditValue.trim();
    setPages((prev) => prev.map((p) => p.id === id ? { ...p, title: val || "Untitled" } : p));
    setInlineEditId(null);
  };

  const wc = wordCount(activePage?.content ?? "");
  const cc = charCount(activePage?.content ?? "");

  const bg = themeMode === "light" ? "#ffffff" : themeMode === "dark" ? "#111110" : customBg;
  const fg = themeMode === "light" ? "#1a1a18" : themeMode === "dark" ? "#e0e0dc" : customFg;
  const muted = themeMode === "light" ? "#b0b0b0" : themeMode === "dark" ? "#4a4a45" : `${customFg}99`;
  const borderColor = themeMode === "light" ? "#e0e0dc" : themeMode === "dark" ? "#232320" : `${customFg}30`;
  const activeItemBg = themeMode === "light" ? "#f0f0ee" : themeMode === "dark" ? "#1e1e1b" : `${customFg}18`;
  const hoverBg = themeMode === "light" ? "#f5f5f3" : themeMode === "dark" ? "#191917" : `${customFg}11`;
  const divider = `1px dotted ${borderColor}`;

  return (
    <div className="size-full flex overflow-hidden select-none" style={{ background: bg, color: fg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {showNewModal && (
        <NameModal dark={dark} label="Name your page"
          onConfirm={(name) => { addPage(name); setShowNewModal(false); }}
          onCancel={() => setShowNewModal(false)} />
      )}

      {menuState && (
        <PageMenu dark={dark}
          pinned={pages.find((p) => p.id === menuState.id)?.pinned ?? false}
          onPin={() => pinPage(menuState.id)}
          onRename={() => { setInlineEditId(menuState.id); setInlineEditValue(getTitle(pages.find(p => p.id === menuState.id)!)); setMenuState(null); }}
          onDelete={() => { deletePage(menuState.id); setMenuState(null); }}
          onClose={() => setMenuState(null)}
          anchorRect={menuState.rect} />
      )}

      {/* Sidebar */}
      {!focusMode && (
        <div className="flex flex-col shrink-0 overflow-hidden transition-all duration-200"
          style={{ width: sidebarOpen ? 220 : 0, background: bg, borderRight: divider, opacity: sidebarOpen ? 1 : 0 }}>

          {/* Header: SimpleNotes logo + new page button */}
          <div className="flex items-center justify-between px-4 shrink-0" style={{ height: 52, borderBottom: divider }}>
            <span style={{ fontSize: 16, color: muted, letterSpacing: "0.01em" }}>SimpleNotes</span>
            <button onClick={() => setShowNewModal(true)}
              className="flex items-center justify-center rounded transition-colors"
              style={{ width: 26, height: 26, color: muted }}
              onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title="New page">
              <Plus size={14} />
            </button>
          </div>

          {/* Page list */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", paddingTop: 30, paddingBottom: 4 }}>
            {sortedPages.map((page) => {
              const isActive = page.id === activeId;
              const isHovered = hoveredId === page.id;
              const menuOpen = menuState?.id === page.id;
              const isEditing = inlineEditId === page.id;

              return (
                <div key={page.id}
                  className="group flex items-center gap-2 px-3 cursor-pointer"
                  style={{ height: 40, background: isActive ? activeItemBg : "transparent", borderRadius: 6, margin: "1px 6px" }}
                  onClick={() => { if (!isEditing) setActiveId(page.id); }}
                  onMouseEnter={() => setHoveredId(page.id)}
                  onMouseLeave={() => { if (!menuOpen) setHoveredId(null); }}>

                  {isEditing ? (
                    <input ref={inlineInputRef} value={inlineEditValue}
                      onChange={(e) => setInlineEditValue(e.target.value)}
                      onBlur={() => commitRename(page.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitRename(page.id); if (e.key === "Escape") setInlineEditId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 outline-none bg-transparent"
                      style={{ fontSize: 13, color: fg, borderBottom: `1px solid ${borderColor}` }} />
                  ) : (
                    <span className="flex-1 truncate"
                      style={{ fontSize: 13, color: isActive ? fg : muted }}
                      onDoubleClick={(e) => { e.stopPropagation(); setInlineEditId(page.id); setInlineEditValue(getTitle(page)); }}>
                      {getTitle(page)}
                    </span>
                  )}

                  {!isEditing && (isHovered || menuOpen || page.pinned) && (
                    <button className="flex items-center justify-center rounded shrink-0 transition-colors"
                      style={{ width: 20, height: 20, color: muted, background: "transparent" }}
                      onClick={(e) => { e.stopPropagation(); setMenuState({ id: page.id, rect: e.currentTarget.getBoundingClientRect() }); }}>
                      {page.pinned && !isHovered && !menuOpen ? <Pin size={11} /> : <MoreHorizontal size={13} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3 shrink-0" style={{ borderTop: divider }}>
            <span style={{ fontSize: 11, color: muted }}>{pages.length} {pages.length === 1 ? "page" : "pages"}</span>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ position: "relative" }}>
        {/* Toolbar */}
        {!focusMode && (
          <div className="flex items-center px-4 shrink-0" style={{ height: 52, borderBottom: divider }}>
            <button onClick={() => setSidebarOpen((v) => !v)}
              className="flex items-center justify-center rounded transition-colors"
              style={{ width: 30, height: 30, color: muted }}
              onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}>
              {sidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3" style={{ color: muted, fontSize: 12 }}>
                <span className="flex items-center gap-1"><Hash size={11} />{wc.toLocaleString()} words</span>
                <span className="flex items-center gap-1"><AlignLeft size={11} />{cc.toLocaleString()} chars</span>
              </div>

              <button
                onClick={() => setFocusMode(true)}
                className="rounded px-3 transition-colors"
                style={{ height: 28, fontSize: 12, color: muted, background: "transparent", border: "1px solid #e05252", marginLeft: 8 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                Focus
              </button>

              <ThemeDropdown
                themeMode={themeMode} customBg={customBg} customFg={customFg}
                hoverBg={hoverBg} muted={muted} borderColor={borderColor}
                onLight={() => setThemeMode("light")}
                onDark={() => setThemeMode("dark")}
                onCustom={(bg, fgColor) => { setCustomBg(bg); setCustomFg(fgColor); setThemeMode("custom"); }}
                onClear={() => setThemeMode("light")}
              />
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto flex justify-center" style={{ scrollbarWidth: "thin", scrollbarColor: `${borderColor} transparent` }}>
          {focusMode && (
            <button onClick={() => setFocusMode(false)}
              className="fixed top-4 right-4 z-10 rounded px-3"
              style={{ height: 28, fontSize: 12, color: muted, background: hoverBg, border: "1px solid #e05252" }}>
              Exit focus
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={activePage?.content ?? ""}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start writing…"
            spellCheck
            className="w-full resize-none outline-none bg-transparent"
            style={{ maxWidth: 680, padding: "72px 24px", fontFamily: "'Lora', Georgia, serif", fontSize: 18, lineHeight: 1.85, color: fg, caretColor: fg, minHeight: "100%", scrollbarWidth: "none" }}
          />
        </div>

        {/* Focus mode bottom bar */}
        {focusMode && (
          <div className="flex items-center justify-center gap-6 shrink-0 py-3"
            style={{ fontSize: 12, color: muted, borderTop: divider }}>
            <span className="flex items-center gap-1"><Hash size={11} />{wc.toLocaleString()} words</span>
            <span className="flex items-center gap-1"><AlignLeft size={11} />{cc.toLocaleString()} chars</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatTimer(focusSeconds)}</span>
          </div>
        )}

        {/* Save indicator — bottom right */}
        {saveIndicator !== "idle" && (
          <div className="fixed bottom-4 right-4 z-20 pointer-events-none"
            style={{ fontSize: 11, color: muted }}>
            {saveIndicator === "saving" ? "saving…" : "saved"}
          </div>
        )}
      </div>
    </div>
  );
}
