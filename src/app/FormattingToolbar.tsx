import { useState, useEffect, useRef, type RefObject } from "react";
import { Bold, Underline, Strikethrough, ListOrdered, List, CheckSquare, Mic, RotateCcw } from "lucide-react";
import type { getThemeColors } from "./utils";

type Theme = ReturnType<typeof getThemeColors>;

// ── Individual toolbar button ────────────────────────────────────────────────

function ToolbarBtn({
  icon,
  title,
  onClick,
  theme,
  active = false,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  theme: Theme;
  active?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  let bg = "transparent";
  let color = theme.muted;

  if (active) {
    bg = theme.activeItem;
    color = theme.fg;
  } else if (hovered) {
    bg = theme.hover;
    color = theme.fg;
  }

  return (
    <button
      title={title}
      // onMouseDown + preventDefault keeps editor focus & selection intact
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 34,
        height: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 7,
        border: "none",
        background: bg,
        color: color,
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.12s, color 0.12s",
      }}
    >
      {icon}
    </button>
  );
}

// ── Vertical divider between button groups ───────────────────────────────────

function Divider({ theme }: { theme: Theme }) {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: theme.border,
        margin: "0 3px",
        flexShrink: 0,
      }}
    />
  );
}

// ── Main toolbar ─────────────────────────────────────────────────────────────

export function FormattingToolbar({
  editorRef,
  theme,
  focusMode = false,
}: {
  editorRef: RefObject<HTMLDivElement | null>;
  theme: Theme;
  focusMode?: boolean;
}) {
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    underline: false,
    strikeThrough: false,
    insertOrderedList: false,
    insertUnorderedList: false,
  });

  useEffect(() => {
    function updateActiveFormats() {
      if (document.activeElement === editorRef.current) {
        setActiveFormats({
          bold: document.queryCommandState("bold"),
          underline: document.queryCommandState("underline"),
          strikeThrough: document.queryCommandState("strikeThrough"),
          insertOrderedList: document.queryCommandState("insertOrderedList"),
          insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        });
      } else {
        setActiveFormats({
          bold: false,
          underline: false,
          strikeThrough: false,
          insertOrderedList: false,
          insertUnorderedList: false,
        });
      }
    }

    document.addEventListener("selectionchange", updateActiveFormats);
    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener("focus", updateActiveFormats);
      editor.addEventListener("blur", updateActiveFormats);
      editor.addEventListener("keyup", updateActiveFormats);
      editor.addEventListener("mouseup", updateActiveFormats);
    }

    return () => {
      document.removeEventListener("selectionchange", updateActiveFormats);
      if (editor) {
        editor.removeEventListener("focus", updateActiveFormats);
        editor.removeEventListener("blur", updateActiveFormats);
        editor.removeEventListener("keyup", updateActiveFormats);
        editor.removeEventListener("mouseup", updateActiveFormats);
      }
    };
  }, [editorRef]);

  // Clean up timers and recognition on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [dictationError, setDictationError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const isRecordingRef = useRef(false);

  function startRecognitionProcess() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentText = finalTranscript + interimTranscript;
      const targetMarker = document.getElementById("voice-dictation-marker");
      if (targetMarker) {
        targetMarker.textContent = currentText;
      }
      editorRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech" || event.error === "aborted") {
        // Ignore silence or non-fatal aborts
        return;
      }

      // Stop the timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      // Map browser errors to user-friendly messages
      let msg = `Error: ${event.error}`;
      if (event.error === "not-allowed") {
        msg = "Mic access denied";
      } else if (event.error === "audio-capture") {
        msg = "No microphone found";
      } else if (event.error === "network") {
        const isBrave = typeof (navigator as any).brave !== "undefined";
        if (isBrave) {
          msg = "Network failed: Enable 'Google Services for speech recognition' in Brave Privacy Settings.";
        } else {
          msg = "Network failed: Check your connection or browser settings.";
        }
      } else if (event.error === "service-not-allowed") {
        msg = "Speech service blocked";
      }

      setDictationError(msg);

      // Stop the recognition, but keep overlay open to display the error
      isRecordingRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      // Auto-restart if browser terminated it but user didn't click Done
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.error("Error restarting recognition:", e);
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
    }
  }

  function startDictation() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please try Chrome, Safari, or Edge.");
      return;
    }

    if (!editorRef.current) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (!selection) return;

    if (selection.rangeCount === 0) {
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const marker = document.createElement("span");
    marker.id = "voice-dictation-marker";
    marker.style.opacity = "0.8";
    marker.style.borderBottom = `1px dotted ${theme.border}`;
    
    range.insertNode(marker);
    selection.collapseToEnd();

    setDictationError(null);
    isRecordingRef.current = true;
    setIsRecording(true);
    setSeconds(0);

    startRecognitionProcess();

    timerIntervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  }

  function stopDictation() {
    isRecordingRef.current = false;
    setDictationError(null);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);

    const marker = document.getElementById("voice-dictation-marker");
    if (marker) {
      const text = marker.textContent || "";
      const textNode = document.createTextNode(text);
      marker.parentNode?.replaceChild(textNode, marker);
    }
    editorRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function resetDictation() {
    const marker = document.getElementById("voice-dictation-marker");
    if (marker) {
      marker.textContent = "";
    }
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      setTimeout(() => {
        if (isRecordingRef.current) {
          startRecognitionProcess();
        }
      }, 300);
    }
    editorRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /** Re-focus the editor and dispatch an input event so React state syncs. */
  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value ?? undefined);
    // Notify React that innerHTML changed
    editorRef.current?.dispatchEvent(new Event("input", { bubbles: true }));

    // Update active formats instantly
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
    });
  }

  function handleBold() { exec("bold"); }
  function handleUnderline() { exec("underline"); }
  function handleStrikethrough() { exec("strikeThrough"); }

  function handleNumberedList() { exec("insertOrderedList"); }
  function handleBulletList() { exec("insertUnorderedList"); }

  function handleCheckbox() {
    editorRef.current?.focus();
    // Insert an inline checkbox with contenteditable="false" to prevent visual editing/caret bugs
    document.execCommand(
      "insertHTML",
      false,
      '<input type="checkbox" class="note-checkbox" contenteditable="false"> '
    );
    editorRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (isRecording) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: focusMode ? 58 : 14,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: dictationError ? "8px 12px 8px 14px" : "4px 8px 4px 14px",
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)",
          userSelect: "none",
          transition: "bottom 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          height: "auto",
          minHeight: 42,
          minWidth: 320,
          maxWidth: "90vw",
          width: "max-content",
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: theme.muted,
            fontFamily: "monospace",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>

        {dictationError ? (
          <div
            style={{
              color: "#e05252",
              fontSize: 12,
              fontWeight: 500,
              flex: 1,
              textAlign: "center",
              whiteSpace: "normal",
              lineHeight: "1.3",
              padding: "4px 8px",
            }}
          >
            {dictationError}
          </div>
        ) : (
          <div className="waveform-container" style={{ color: theme.fg, flex: 1, justifyContent: "center" }}>
            {Array.from({ length: 32 }).map((_, idx) => (
              <span key={idx} className="waveform-bar" />
            ))}
          </div>
        )}

        {!dictationError && (
          <button
            title="Clear speech text"
            onClick={resetDictation}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 7,
              border: "none",
              background: "transparent",
              color: theme.muted,
              cursor: "pointer",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.hover;
              e.currentTarget.style.color = theme.fg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = theme.muted;
            }}
          >
            <RotateCcw size={14} />
          </button>
        )}

        <button
          onClick={stopDictation}
          style={{
            height: 32,
            padding: "0 14px",
            fontSize: 13,
            fontWeight: 500,
            color: theme.fg,
            background: theme.activeItem,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            cursor: "pointer",
            transition: "background 0.12s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = theme.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = theme.activeItem; }}
        >
          {dictationError ? "Close" : "Done"}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: focusMode ? 58 : 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        padding: "3px 6px",
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)",
        // Prevent the toolbar itself from being selected or focused
        userSelect: "none",
        transition: "bottom 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Text formatting group */}
      <ToolbarBtn icon={<Bold size={15} />} title="Bold" onClick={handleBold} theme={theme} active={activeFormats.bold} />
      <ToolbarBtn icon={<Underline size={15} />} title="Underline" onClick={handleUnderline} theme={theme} active={activeFormats.underline} />
      <ToolbarBtn icon={<Strikethrough size={15} />} title="Strikethrough" onClick={handleStrikethrough} theme={theme} active={activeFormats.strikeThrough} />

      <Divider theme={theme} />

      {/* List group */}
      <ToolbarBtn icon={<ListOrdered size={15} />} title="Numbered List" onClick={handleNumberedList} theme={theme} active={activeFormats.insertOrderedList} />
      <ToolbarBtn icon={<List size={15} />} title="Bullet List" onClick={handleBulletList} theme={theme} active={activeFormats.insertUnorderedList} />
      <ToolbarBtn icon={<CheckSquare size={15} />} title="Checkbox" onClick={handleCheckbox} theme={theme} />

      <Divider theme={theme} />

      {/* Voice Dictation */}
      <ToolbarBtn icon={<Mic size={15} />} title="Voice to Text" onClick={startDictation} theme={theme} />
    </div>
  );
}
