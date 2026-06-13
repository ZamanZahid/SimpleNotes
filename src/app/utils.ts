// Types — describes the shape of our data

export interface Page {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ThemeMode = "light" | "dark" | "custom";

export interface AppData {
  pages: Page[];
  activeId: string | null;
  themeMode: ThemeMode;
  customBg: string;
  customFg: string;
}

// This is where notes are saved in the browser
export const STORAGE_KEY = "blankpage_data";

const DEFAULT_CUSTOM_BG = "#2d4a3e";
const DEFAULT_CUSTOM_FG = "#ffffff";

// This is the empty starting data when nothing is saved yet
export function getEmptyData(): AppData {
  return {
    pages: [],
    activeId: null,
    themeMode: "light",
    customBg: DEFAULT_CUSTOM_BG,
    customFg: DEFAULT_CUSTOM_FG,
  };
}

// This creates a brand new note
export function createPage(content = "", title = ""): Page {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    title,
    content,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

// Show the note title, or the first line of text, or "Untitled"
export function getTitle(page: Page): string {
  if (page.title) return page.title;
  let plain = "";
  if (typeof window !== "undefined" && window.DOMParser) {
    const htmlWithNewlines = page.content.replace(/<br\s*\/?>/gi, "\n");
    const doc = new DOMParser().parseFromString(htmlWithNewlines, "text/html");
    plain = doc.body.textContent || "";
  } else {
    plain = page.content
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }
  const firstLine = plain.trim().split("\n")[0]?.trim();
  return firstLine || "Untitled";
}

// Counter for the text typed
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

export function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Load saved notes from the browser
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getEmptyData();

    const saved = JSON.parse(raw);
    return {
      pages: saved.pages.map((page: Page) => ({
        ...page,
        pinned: page.pinned ?? false,
        createdAt: new Date(page.createdAt),
        updatedAt: new Date(page.updatedAt),
      })),
      activeId: saved.activeId,
      themeMode: saved.themeMode ?? "light",
      customBg: saved.customBg ?? DEFAULT_CUSTOM_BG,
      customFg: saved.customFg ?? DEFAULT_CUSTOM_FG,
    };
  } catch {
    return getEmptyData();
  }
}

// Save notes to the browser using localStorage
export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// This makes linned notes go to the top of the list
export function sortPages(pages: Page[]): Page[] {
  const pinned = pages.filter((p) => p.pinned);
  const unpinned = pages.filter((p) => !p.pinned);
  return [...pinned, ...unpinned];
}

// This is for the colors for light, dark, or custom theme
export function getThemeColors(themeMode: ThemeMode, customBg: string, customFg: string) {
  if (themeMode === "light") {
    return {
      bg: "#ffffff",
      fg: "#b0b0b0",
      muted: "#b0b0b0",
      border: "#e0e0dc",
      activeItem: "#f0f0ee",
      hover: "#f5f5f3",
    };
  }

  if (themeMode === "dark") {
    return {
      bg: "#111110",
      fg: "#b0b0b0",
      muted: "#4a4a45",
      border: "#232320",
      activeItem: "#1e1e1b",
      hover: "#191917",
    };
  }

  // This is for the custom theme
  return {
    bg: customBg,
    fg: customFg,
    muted: `${customFg}99`,
    border: `${customFg}30`,
    activeItem: `${customFg}18`,
    hover: `${customFg}11`,
  };
}

// This is for the colors for popups and menus
export function getModalColors(dark: boolean) {
  if (dark) {
    return {
      bg: "#1a1a18",
      fg: "#e0e0dc",
      muted: "#4a4a45",
      border: "#2e2e2a",
      inputBg: "#111110",
    };
  }

  return {
    bg: "#ffffff",
    fg: "#1a1a18",
    muted: "#b0b0b0",
    border: "#e0e0dc",
    inputBg: "#f5f5f3",
  };
}
