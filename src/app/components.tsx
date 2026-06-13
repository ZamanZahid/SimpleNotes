import { useState, useEffect, useRef, useCallback, type ReactNode, type CSSProperties } from "react";
import { Moon, Sun, AlignLeft, Hash, Palette } from "lucide-react";
import { getModalColors, getThemeColors, type ThemeMode } from "./utils";

// A small button with a hover effect
export function IconButton({
  onClick,
  title,
  hoverBg,
  muted,
  size = 30,
  children,
}: {
  onClick?: () => void;
  title?: string;
  hoverBg: string;
  muted: string;
  size?: number;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center rounded transition-colors"
      style={{ width: size, height: size, color: muted, background: "transparent" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

// Shows word count and character count in the toolbar on the top right
export function WordStats({ words, chars, muted }: { words: number; chars: number; muted: string }) {
  return (
    <div className="flex items-center gap-3" style={{ color: muted, fontSize: 12 }}>
      <span className="flex items-center gap-1">
        <Hash size={11} />
        {words.toLocaleString()} words
      </span>
      <span className="flex items-center gap-1">
        <AlignLeft size={11} />
        {chars.toLocaleString()} chars
      </span>
    </div>
  );
}

// Popup that asks the user to name a new page
export function NameModal({
  dark,
  label = "Page name",
  onConfirm,
  onCancel,
}: {
  dark: boolean;
  label?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const colors = getModalColors(dark);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit() {
    onConfirm(name.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={onCancel}
    >
      <div
        className="flex flex-col gap-4 rounded-xl p-5"
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          width: 320,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{ fontSize: 14, color: colors.fg }}>{label}</span>

        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Untitled"
          className="rounded-lg px-3 outline-none"
          style={{
            height: 36,
            background: colors.inputBg,
            border: `1px solid ${colors.border}`,
            color: colors.fg,
            fontSize: 14,
          }}
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg px-4"
            style={{
              height: 32,
              fontSize: 13,
              color: colors.muted,
              background: "transparent",
              border: `1px solid ${colors.border}`,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg px-4"
            style={{
              height: 32,
              fontSize: 13,
              color: dark ? "#111110" : "#fff",
              background: dark ? "#e0e0dc" : "#1a1a18",
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// The three-dot menu on each page (Pin, Rename, Delete)
export function PageMenu({
  dark,
  pinned,
  anchorRect,
  onPin,
  onRename,
  onDelete,
  onClose,
}: {
  dark: boolean;
  pinned: boolean;
  anchorRect: DOMRect;
  onPin: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const colors = getModalColors(dark);
  const menuBg = dark ? "#1e1e1b" : "#ffffff";
  const hoverBg = dark ? "#2a2a27" : "#f0f0ee";

  // Close menu when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  function MenuItem({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
    return (
      <button
        className="w-full text-left px-3 rounded-lg transition-colors"
        style={{
          height: 34,
          fontSize: 13,
          color: danger ? "#e05252" : colors.fg,
          background: "transparent",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => { onClick(); onClose(); }}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 flex flex-col p-1 rounded-xl"
      style={{
        top: anchorRect.bottom + 4,
        left: anchorRect.right - 150,
        width: 150,
        background: menuBg,
        border: `1px solid ${colors.border}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
      }}
    >
      <MenuItem label={pinned ? "Unpin" : "Pin"} onClick={onPin} />
      <MenuItem label="Rename" onClick={onRename} />
      <MenuItem label="Delete" onClick={onDelete} danger />
    </div>
  );
}

// Dropdown to pick light, dark, or custom theme
export function ThemeDropdown({
  themeMode,
  customBg,
  customFg,
  hoverBg,
  muted,
  onLight,
  onDark,
  onCustom,
  onClear,
}: {
  themeMode: ThemeMode;
  customBg: string;
  customFg: string;
  hoverBg: string;
  muted: string;
  onLight: () => void;
  onDark: () => void;
  onCustom: (bg: string, fg: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [localBg, setLocalBg] = useState(customBg);
  const [localFg, setLocalFg] = useState(customFg);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bgColorInputRef = useRef<HTMLInputElement>(null);
  const fgColorInputRef = useRef<HTMLInputElement>(null);

  const theme = getThemeColors(themeMode, customBg, customFg);

  useEffect(() => {
    setLocalBg(customBg);
  }, [customBg]);

  useEffect(() => {
    setLocalFg(customFg);
  }, [customFg]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  const themeIcon =
    themeMode === "light" ? <Sun size={14} /> :
    themeMode === "dark" ? <Moon size={14} /> :
    <Palette size={14} />;

  function swatchStyle(active: boolean, extra: CSSProperties): CSSProperties {
    return {
      width: 32,
      height: 32,
      borderRadius: 6,
      border: active ? "1.5px solid #aaaaaa" : `1px solid ${theme.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flexShrink: 0,
      ...extra,
    };
  }

  function pickTheme(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <IconButton onClick={() => setOpen(!open)} hoverBg={hoverBg} muted={muted} size={30}>
        {themeIcon}
      </IconButton>

      <div
        className="absolute right-0 top-full mt-1 z-50 flex flex-col items-center gap-2 p-2 transition-all duration-150 ease-out"
        style={{
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          borderRadius: 10,
          boxShadow: themeMode === "dark" ? "0 6px 20px rgba(0,0,0,0.5)" : "0 6px 20px rgba(0,0,0,0.13)",
          opacity: open ? 1 : 0,
          transform: open ? "scale(1) translateY(0)" : "scale(0.95) translateY(-8px)",
          pointerEvents: open ? "auto" : "none",
          transformOrigin: "top right",
        }}
      >
        <button
          style={swatchStyle(themeMode === "light", { background: "#ffffff", color: "#888888" })}
          onClick={() => pickTheme(onLight)}
          title="Light"
        >
          <Sun size={13} />
        </button>

        <button
          style={swatchStyle(themeMode === "dark", {
            background: "#111110",
            color: "#777770",
            border: themeMode === "dark" ? "1.5px solid #777770" : "1px solid #333330",
          })}
          onClick={() => pickTheme(onDark)}
          title="Dark"
        >
          <Moon size={13} />
        </button>

        <div
          style={{
            width: "100%",
            height: 1,
            background: theme.border,
            margin: "2px 0",
          }}
        />

        <button
          style={swatchStyle(themeMode === "custom", { background: localBg, overflow: "hidden" })}
          onClick={() => bgColorInputRef.current?.click()}
          title="Background color"
        />

        <input
          ref={bgColorInputRef}
          type="color"
          value={localBg}
          onChange={(e) => {
            const bg = e.target.value;
            setLocalBg(bg);
            const targetFg = themeMode === "custom" ? customFg : "#ffffff";
            onCustom(bg, targetFg);
          }}
          style={{ width: 0, height: 0, opacity: 0, position: "absolute", pointerEvents: "none" }}
        />

        <button
          style={swatchStyle(themeMode === "custom", {
            background: "#f5f5f3",
            color: localFg,
            fontSize: 14,
            fontWeight: 600,
            overflow: "hidden",
          })}
          onClick={() => fgColorInputRef.current?.click()}
          title="Text color"
        >
          A
        </button>

        <input
          ref={fgColorInputRef}
          type="color"
          value={localFg}
          onChange={(e) => {
            const fg = e.target.value;
            setLocalFg(fg);
            const targetBg =
              themeMode === "light" ? "#ffffff" :
              themeMode === "dark" ? "#111110" :
              customBg;
            onCustom(targetBg, fg);
          }}
          style={{ width: 0, height: 0, opacity: 0, position: "absolute", pointerEvents: "none" }}
        />

        <div
          style={{
            width: "100%",
            height: 1,
            background: theme.border,
            margin: "2px 0",
          }}
        />

        <button
          onClick={() => pickTheme(onClear)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: "1px solid #e05252",
            fontSize: 10,
            color: "#e05252",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
