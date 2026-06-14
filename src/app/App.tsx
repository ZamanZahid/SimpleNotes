import { useState, useEffect, useRef } from "react";
import { Plus, ChevronLeft, ChevronRight, AlignLeft, Hash, Pin, MoreHorizontal } from "lucide-react";
import {
  createPage,
  getTitle,
  countWords,
  formatTimer,
  loadData,
  saveData,
  sortPages,
  getThemeColors,
  getEmptyData,
  type Page,
  type ThemeMode,
} from "./utils";
import { IconButton, WordStats, NameModal, PageMenu, ThemeDropdown } from "./components";
import { FormattingToolbar } from "./FormattingToolbar";

// Strip HTML tags to get raw plain text for word/char counting
function stripHtml(html: string): string {
  let text = "";
  if (typeof window !== "undefined" && window.DOMParser) {
    const htmlWithNewlines = html.replace(/<br\s*\/?>/gi, "\n");
    const doc = new DOMParser().parseFromString(htmlWithNewlines, "text/html");
    text = doc.body.textContent || "";
  } else {
    text = html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }
  return text.replace(/\s+/g, " ").trim();
}

export default function App() {
  // Load saved data, or start with a Welcome note
  const saved = loadData();
  const startingPages = saved.pages.length > 0 ? saved.pages : [createPage("", "Welcome")];

  // --- State ---
  const [pages, setPages] = useState(startingPages);
  const [activeId, setActiveId] = useState(saved.activeId ?? startingPages[0].id);
  const [themeMode, setThemeMode] = useState<ThemeMode>(saved.themeMode);
  const [customBg, setCustomBg] = useState(saved.customBg);
  const [customFg, setCustomFg] = useState(saved.customFg);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [showNewModal, setShowNewModal] = useState(false);
  const [menuState, setMenuState] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // --- Refs ---
  const editorRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);   // visual "saved" indicator timer
  const contentSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null); // debounced localStorage write
  const focusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusStartRef = useRef<number>(0);

  // Always-fresh refs to prevent stale closures inside debounced callbacks
  const activeIdRef = useRef(activeId);
  const themeModeRef = useRef(themeMode);
  const customBgRef = useRef(customBg);
  const customFgRef = useRef(customFg);
  activeIdRef.current = activeId;
  themeModeRef.current = themeMode;
  customBgRef.current = customBg;
  customFgRef.current = customFg;

  // --- Derived values ---
  const theme = getThemeColors(themeMode, customBg, customFg);
  const divider = `1px dotted ${theme.border}`;
  const activePage = pages.find((p) => p.id === activeId) ?? pages[0];
  const content = activePage?.content ?? "";
  const plainText = stripHtml(content);
  const wordCount = countWords(plainText);
  const charCount = plainText.length;
  const menuPage = menuState ? pages.find((p) => p.id === menuState.id) : null;

  // Save settings (activeId, theme) immediately whenever they change.
  // NOTE: "pages" is intentionally absent — content changes are debounced via updateContent().
  useEffect(() => {
    saveData({ pages, activeId, themeMode, customBg, customFg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, themeMode, customBg, customFg]);

  // Synchronously save any unsaved editor content if the browser tab/page is closed
  useEffect(() => {
    function handleBeforeUnload() {
      if (contentSaveRef.current) {
        clearTimeout(contentSaveRef.current);
        saveData({ pages, activeId, themeMode, customBg, customFg });
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [pages, activeId, themeMode, customBg, customFg]);

  // Keyboard shortcuts (Escape to exit Focus Mode, Cmd/Ctrl + S to force save)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && focusMode) {
        setFocusMode(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (contentSaveRef.current) {
          clearTimeout(contentSaveRef.current);
          contentSaveRef.current = null;
        }
        saveData({ pages, activeId, themeMode, customBg, customFg });
        setSaveStatus("saved");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode, pages, activeId, themeMode, customBg, customFg]);

  // Sync editor innerHTML when switching pages (NOT when content changes from typing)
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = content;
    setTimeout(() => editorRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]); // only activeId — never "content", or cursor jumps on every keystroke

  // Focus the rename input when renaming starts
  useEffect(() => {
    if (!editingId) return;
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 30);
  }, [editingId]);

  // Stopwatch while in focus mode
  useEffect(() => {
    if (focusMode) {
      setFocusSeconds(0);
      focusStartRef.current = Date.now();
      focusTimerRef.current = setInterval(() => {
        setFocusSeconds(Math.floor((Date.now() - focusStartRef.current) / 1000));
      }, 1000);
    } else if (focusTimerRef.current) {
      clearInterval(focusTimerRef.current);
    }
    return () => {
      if (focusTimerRef.current) clearInterval(focusTimerRef.current);
    };
  }, [focusMode]);

  // Handle editor click (for checkboxes) and paste events (for HTML sanitization)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    function onCheckboxClick(e: MouseEvent) {
      const target = e.target as HTMLInputElement;
      if (target.tagName !== "INPUT" || target.type !== "checkbox") return;

      // Sync the DOM attribute so innerHTML reflects the visual state
      setTimeout(() => {
        if (target.checked) {
          target.setAttribute("checked", "checked");
        } else {
          target.removeAttribute("checked");
        }
        if (editorRef.current) {
          updateContent(editorRef.current.innerHTML);
        }
      }, 0);
    }

    function sanitizeElement(el: Element) {
      const children = Array.from(el.children);
      for (const child of children) {
        const tagName = child.tagName.toLowerCase();
        if (
          ["script", "style", "iframe", "frame", "object", "embed", "applet", "link", "meta", "base", "form", "button", "textarea", "select"].includes(tagName) ||
          (tagName === "input" && (child as HTMLInputElement).type !== "checkbox")
        ) {
          child.remove();
          continue;
        }

        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          const name = attr.name.toLowerCase();
          const val = attr.value.toLowerCase().trim();
          if (name.startsWith("on")) {
            child.removeAttribute(attr.name);
          } else if ((name === "href" || name === "src") && val.startsWith("javascript:")) {
            child.removeAttribute(attr.name);
          }
        }
        sanitizeElement(child);
      }
    }

    function onPaste(e: ClipboardEvent) {
      e.preventDefault();
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const html = clipboardData.getData("text/html");
      const text = clipboardData.getData("text/plain");

      if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Clean body level attributes
        const bodyAttrs = Array.from(doc.body.attributes);
        for (const attr of bodyAttrs) {
          const name = attr.name.toLowerCase();
          const val = attr.value.toLowerCase().trim();
          if (name.startsWith("on") || ((name === "href" || name === "src") && val.startsWith("javascript:"))) {
            doc.body.removeAttribute(attr.name);
          }
        }

        sanitizeElement(doc.body);
        document.execCommand("insertHTML", false, doc.body.innerHTML);
      } else if (text) {
        document.execCommand("insertText", false, text);
      }
    }

    editor.addEventListener("click", onCheckboxClick);
    editor.addEventListener("paste", onPaste as any);
    return () => {
      editor.removeEventListener("click", onCheckboxClick);
      editor.removeEventListener("paste", onPaste as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // --- Actions ---

  /**
   * Called on every editor input event.
   * Updates React state immediately (for UI) and schedules a debounced
   * localStorage write 600 ms after the last keystroke.
   */
  function updateContent(html: string) {
    const newPages = pages.map((page: Page) =>
      page.id === activeIdRef.current
        ? { ...page, content: html, updatedAt: new Date() }
        : page
    );
    setPages(newPages);

    // Visual save indicator
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus("saved"), 800);

    // Debounced localStorage write — only fires 600 ms after typing stops
    if (contentSaveRef.current) clearTimeout(contentSaveRef.current);
    contentSaveRef.current = setTimeout(() => {
      saveData({
        pages: newPages,
        activeId: activeIdRef.current,
        themeMode: themeModeRef.current,
        customBg: customBgRef.current,
        customFg: customFgRef.current,
      });
    }, 2500);
  }

  function handleEditorInput() {
    if (!editorRef.current) return;

    const currentHtml = editorRef.current.innerHTML;
    const currentPlainText = stripHtml(currentHtml);

    const hasMeaningfulContent = editorRef.current.querySelector('ul, ol, input[type="checkbox"]') !== null || currentPlainText.length > 0;

    if (!hasMeaningfulContent) {

      editorRef.current.innerHTML = "";
      updateContent("");
    } else {
      updateContent(currentHtml);
    }
  }

  function addPage(name: string) {
    const page = createPage("", name || "Untitled");
    const unpinned = pages.filter((p: Page) => !p.pinned);
    const pinned = pages.filter((p: Page) => p.pinned);
    const newPages = [page, ...unpinned, ...pinned];
    setPages(newPages);
    setActiveId(page.id);
    saveData({ pages: newPages, activeId: page.id, themeMode, customBg, customFg });
  }

  function deletePage(id: string) {
    const remaining = pages.filter((p: Page) => p.id !== id);
    if (remaining.length === 0) {
      const fresh = createPage("", "Untitled");
      setPages([fresh]);
      setActiveId(fresh.id);
      saveData({ pages: [fresh], activeId: fresh.id, themeMode, customBg, customFg });
      return;
    }
    setPages(remaining);
    const newActiveId = activeId === id ? remaining[0].id : activeId;
    if (activeId === id) setActiveId(newActiveId);
    saveData({ pages: remaining, activeId: newActiveId, themeMode, customBg, customFg });
  }

  function togglePin(id: string) {
    const newPages = pages.map((p: Page) => (p.id === id ? { ...p, pinned: !p.pinned } : p));
    setPages(newPages);
    saveData({ pages: newPages, activeId, themeMode, customBg, customFg });
  }

  function startRename(page: Page) {
    setEditingId(page.id);
    setEditingName(getTitle(page));
  }

  function finishRename(id: string) {
    const newPages = pages.map((page: Page) =>
      page.id === id ? { ...page, title: editingName.trim() || "Untitled" } : page
    );
    setPages(newPages);
    setEditingId(null);
    saveData({ pages: newPages, activeId, themeMode, customBg, customFg });
  }

  // --- Render ---

  return (
    <div
      className="size-full flex overflow-hidden"
      style={{
        background: theme.bg,
        color: theme.fg,
        fontFamily: "'Inter', system-ui, sans-serif",
        ["--theme-bg" as any]: theme.bg,
        ["--theme-fg" as any]: theme.fg,
      }}
    >
      {showNewModal && (
        <NameModal
          dark={themeMode === "dark"}
          label="Name your page"
          onConfirm={(name) => { addPage(name); setShowNewModal(false); }}
          onCancel={() => setShowNewModal(false)}
        />
      )}

      {menuState && menuPage && (
        <PageMenu
          dark={themeMode === "dark"}
          pinned={menuPage.pinned}
          anchorRect={menuState.rect}
          onPin={() => togglePin(menuState.id)}
          onRename={() => { startRename(menuPage); setMenuState(null); }}
          onDelete={() => { deletePage(menuState.id); setMenuState(null); }}
          onClose={() => setMenuState(null)}
        />
      )}

      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <div
        className="flex flex-col shrink-0 overflow-hidden transition-all duration-200 select-none"
        style={{
          width: (sidebarOpen && !focusMode) ? 220 : 0,
          background: theme.bg,
          borderRight: (sidebarOpen && !focusMode) ? divider : "0px solid transparent",
          opacity: (sidebarOpen && !focusMode) ? 1 : 0,
        }}
      >
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{ height: 52, borderBottom: divider }}
        >
          <span style={{ fontSize: 20, fontWeight: 600, color: theme.muted, letterSpacing: "0.01em" }}>
            SimpleNotes
          </span>
          <IconButton
            onClick={() => setShowNewModal(true)}
            hoverBg={theme.hover}
            muted={theme.muted}
            size={26}
            title="New page"
          >
            <Plus size={14} />
          </IconButton>
        </div>

        <div
          className="flex-1 overflow-y-auto"
          style={{ scrollbarWidth: "none", paddingTop: 30, paddingBottom: 4 }}
        >
          {sortPages(pages).map((page) => {
            const isActive = page.id === activeId;
            const isHovered = hoveredId === page.id;
            const menuOpen = menuState?.id === page.id;
            const isEditing = editingId === page.id;
            const showMenu = !isEditing && (isHovered || menuOpen || page.pinned);

            return (
              <div
                key={page.id}
                className="group flex items-center gap-2 px-3 cursor-pointer"
                style={{
                  height: 40,
                  background: isActive ? theme.activeItem : "transparent",
                  borderRadius: 6,
                  margin: "1px 6px",
                }}
                onClick={() => { if (!isEditing) setActiveId(page.id); }}
                onMouseEnter={() => setHoveredId(page.id)}
                onMouseLeave={() => { if (!menuOpen) setHoveredId(null); }}
              >
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => finishRename(page.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finishRename(page.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 outline-none bg-transparent"
                    style={{ fontSize: 13, color: theme.fg, borderBottom: `1px solid ${theme.border}` }}
                  />
                ) : (
                  <span
                    className="flex-1 truncate"
                    style={{ fontSize: 13, color: isActive ? theme.fg : theme.muted }}
                    onDoubleClick={(e) => { e.stopPropagation(); startRename(page); }}
                  >
                    {getTitle(page)}
                  </span>
                )}

                {showMenu && (
                  <button
                    className="flex items-center justify-center rounded shrink-0 transition-colors"
                    style={{ width: 20, height: 20, color: theme.muted, background: "transparent" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuState({ id: page.id, rect: e.currentTarget.getBoundingClientRect() });
                    }}
                  >
                    {page.pinned && !isHovered && !menuOpen
                      ? <Pin size={11} />
                      : <MoreHorizontal size={13} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 shrink-0" style={{ borderTop: divider }}>
          <span style={{ fontSize: 11, color: theme.muted }}>
            {pages.length} {pages.length === 1 ? "page" : "pages"}
          </span>
        </div>
      </div>

      {/* ── Right side: top toolbar + editor ─────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ position: "relative" }}>

        {/* Top toolbar */}
        <div
          className="flex items-center px-4 shrink-0 select-none transition-all duration-200"
          style={{
            height: focusMode ? 0 : 52,
            borderBottom: focusMode ? "1px solid transparent" : divider,
            opacity: focusMode ? 0 : 1,
            pointerEvents: focusMode ? "none" : "auto",
            overflow: focusMode ? "hidden" : "visible",
            zIndex: 10,
          }}
        >
          <IconButton
            onClick={() => setSidebarOpen(!sidebarOpen)}
            hoverBg={theme.hover}
            muted={theme.muted}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {sidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </IconButton>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <WordStats words={wordCount} chars={charCount} muted={theme.muted} />

            <button
              onClick={() => setFocusMode(true)}
              className="rounded px-3 transition-colors"
              style={{
                height: 28,
                fontSize: 12,
                color: theme.muted,
                background: "transparent",
                border: "1px solid #e05252",
                marginLeft: 8,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = theme.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Focus
            </button>

            <ThemeDropdown
              themeMode={themeMode}
              customBg={customBg}
              customFg={customFg}
              hoverBg={theme.hover}
              muted={theme.muted}
              onLight={() => setThemeMode("light")}
              onDark={() => setThemeMode("dark")}
              onCustom={(bg, fg) => { setCustomBg(bg); setCustomFg(fg); setThemeMode("custom"); }}
              onClear={() => {
                const defaults = getEmptyData();
                setThemeMode(defaults.themeMode);
                setCustomBg(defaults.customBg);
                setCustomFg(defaults.customFg);
              }}
            />
          </div>
        </div>

        {/* Scrollable editor area */}
        <div
          className="flex-1 overflow-y-auto flex justify-center"
          style={{ scrollbarWidth: "thin", scrollbarColor: `${theme.border} transparent` }}
        >
          {/* Exit focus button */}
          <button
            onClick={() => setFocusMode(false)}
            className="fixed z-10 rounded px-3 transition-all duration-200"
            style={{
              top: 10,
              right: 62,
              height: 28,
              fontSize: 12,
              color: theme.muted,
              background: theme.hover,
              border: "1px solid #e05252",
              opacity: focusMode ? 1 : 0,
              pointerEvents: focusMode ? "auto" : "none",
              transform: focusMode ? "scale(1)" : "scale(0.95)",
            }}
          >
            Exit focus
          </button>

          {/* ── Contenteditable rich-text editor ── */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleEditorInput}
            data-placeholder="Start writing…"
            className="note-editor w-full outline-none"
            style={{
              maxWidth: 680,
              // Extra bottom padding so content never hides under the floating toolbar
              padding: "72px 24px 140px",
              fontFamily: "'Lora', Georgia, serif",
              fontSize: 18,
              lineHeight: 1.85,
              color: theme.fg,
              caretColor: theme.fg,
              minHeight: "100%",
              scrollbarWidth: "none",
              // Override the select-none class that might propagate from sidebar
              userSelect: "text",
              WebkitUserSelect: "text",
            }}
          />
        </div>

        {/* Focus mode bottom stats bar */}
        <div
          className="flex items-center justify-center gap-6 shrink-0 select-none overflow-hidden transition-all duration-200"
          style={{
            height: focusMode ? 40 : 0,
            opacity: focusMode ? 1 : 0,
            borderTop: focusMode ? divider : "1px solid transparent",
            fontSize: 12,
            color: theme.muted,
            pointerEvents: focusMode ? "auto" : "none",
          }}
        >
          <span className="flex items-center gap-1">
            <Hash size={11} />
            {wordCount.toLocaleString()} words
          </span>
          <span className="flex items-center gap-1">
            <AlignLeft size={11} />
            {charCount.toLocaleString()} chars
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatTimer(focusSeconds)}</span>
        </div>

        {/* Save indicator */}
        {saveStatus !== "idle" && (
          <div
            className="fixed z-20 pointer-events-none select-none"
            style={{ bottom: 12, right: 16, fontSize: 11, color: theme.muted }}
          >
            {saveStatus === "saving" ? "saving…" : "saved"}
          </div>
        )}
      </div>

      {/* ── Floating formatting toolbar (always visible) ─────────── */}
      <FormattingToolbar editorRef={editorRef} theme={theme} focusMode={focusMode} />
    </div>
  );
}
