import { useEffect, useRef, useMemo } from "react";
import { useApp } from "../AppContext.js";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
}

export function CommandPalette() {
  const {
    commandPaletteOpen,
    commandQuery,
    commandActiveIndex,
    agentStatus,
    handleStart,
    handleStop,
    handlePauseResume,
    handleRestart,
    setTab,
    loadPlugins,
    loadSkills,
    loadLogs,
    loadWorkbench,
    handleChatClear,
    setState,
    closeCommandPalette,
  } = useApp();

  const inputRef = useRef<HTMLInputElement>(null);

  const agentState = agentStatus?.state ?? "stopped";
  const isRunning = agentState === "running";
  const isPaused = agentState === "paused";

  // Build command list
  const allCommands = useMemo<CommandItem[]>(() => {
    const commands: CommandItem[] = [];

    // Lifecycle commands
    if (agentState === "stopped" || agentState === "not_started") {
      commands.push({
        id: "start-agent",
        label: "Start Agent",
        action: handleStart,
      });
    } else {
      commands.push({
        id: "stop-agent",
        label: "Stop Agent",
        action: handleStop,
      });
      if (isRunning || isPaused) {
        commands.push({
          id: "pause-resume-agent",
          label: isPaused ? "Resume Agent" : "Pause Agent",
          action: handlePauseResume,
        });
      }
      commands.push({
        id: "restart-agent",
        label: "Restart Agent",
        action: handleRestart,
      });
    }

    // Navigation commands
    commands.push(
      { id: "nav-chat", label: "Open Chat", action: () => setTab("chat") },
      { id: "nav-apps", label: "Open Apps", hint: "Browse & Games", action: () => setTab("apps") },
      { id: "nav-games", label: "Open Games", hint: "Apps > Games", action: () => { setState("appsSubTab", "games"); setTab("apps"); } },
      { id: "nav-agent", label: "Open Agent", hint: "Character & Inventory", action: () => setTab("agent") },
      { id: "nav-character", label: "Open Character", hint: "Agent > Character", action: () => { setState("agentSubTab", "character"); setTab("agent"); } },
      { id: "nav-inventory", label: "Open Inventory", hint: "Agent > Inventory", action: () => { setState("agentSubTab", "inventory"); setTab("agent"); } },
      { id: "nav-plugins", label: "Open Plugins", hint: "Features, Connectors & Skills", action: () => setTab("plugins") },
      { id: "nav-features", label: "Open Features", hint: "Plugins > Features", action: () => { setState("pluginsSubTab", "features"); setTab("plugins"); } },
      { id: "nav-connectors", label: "Open Connectors", hint: "Plugins > Connectors", action: () => { setState("pluginsSubTab", "connectors"); setTab("plugins"); } },
      { id: "nav-skills", label: "Open Skills", hint: "Plugins > Skills", action: () => { setState("pluginsSubTab", "skills"); setTab("plugins"); } },
      { id: "nav-settings", label: "Open Settings", action: () => setTab("settings") },
    );

    // Refresh commands
    commands.push(
      { id: "refresh-plugins", label: "Refresh Features", action: loadPlugins },
      { id: "refresh-skills", label: "Refresh Skills", action: loadSkills },
      { id: "refresh-logs", label: "Refresh Logs", action: loadLogs },
      { id: "refresh-workbench", label: "Refresh Workbench", action: loadWorkbench }
    );

    // Chat commands
    commands.push({
      id: "chat-clear",
      label: "Clear Chat",
      action: handleChatClear,
    });

    return commands;
  }, [
    agentState,
    isRunning,
    isPaused,
    handleStart,
    handleStop,
    handlePauseResume,
    handleRestart,
    setTab,
    setState,
    handleChatClear,
    loadPlugins,
    loadSkills,
    loadLogs,
    loadWorkbench,
  ]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!commandQuery.trim()) return allCommands;
    const query = commandQuery.toLowerCase();
    return allCommands.filter((cmd) => cmd.label.toLowerCase().includes(query));
  }, [allCommands, commandQuery]);

  // Auto-focus input when opened
  useEffect(() => {
    if (commandPaletteOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [commandPaletteOpen]);

  // Keyboard handling
  useEffect(() => {
    if (!commandPaletteOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeCommandPalette();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setState(
          "commandActiveIndex",
          commandActiveIndex < filteredCommands.length - 1 ? commandActiveIndex + 1 : 0
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setState(
          "commandActiveIndex",
          commandActiveIndex > 0 ? commandActiveIndex - 1 : filteredCommands.length - 1
        );
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filteredCommands[commandActiveIndex];
        if (cmd) {
          cmd.action();
          closeCommandPalette();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    commandPaletteOpen,
    commandActiveIndex,
    filteredCommands,
    setState,
    closeCommandPalette,
  ]);

  // Reset active index when query changes
  useEffect(() => {
    if (commandQuery !== "") {
      setState("commandActiveIndex", 0);
    }
  }, [commandQuery, setState]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[9999] flex items-start justify-center pt-30"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeCommandPalette();
        }
      }}
    >
      <div
        className="bg-bg border border-border w-[520px] max-h-[420px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          className="w-full px-4 py-3.5 border-b border-border bg-transparent text-[15px] text-txt outline-none font-body"
          placeholder="Type to search commands..."
          value={commandQuery}
          onChange={(e) => setState("commandQuery", e.target.value)}
        />
        <div className="flex-1 overflow-y-auto py-1">
          {filteredCommands.length === 0 ? (
            <div className="py-5 text-center text-muted text-[13px]">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.id}
                className={`w-full px-4 py-2.5 cursor-pointer flex justify-between items-center text-left text-sm font-body ${
                  idx === commandActiveIndex ? "bg-bg-hover" : "hover:bg-bg-hover"
                }`}
                onClick={() => {
                  cmd.action();
                  closeCommandPalette();
                }}
                onMouseEnter={() => setState("commandActiveIndex", idx)}
              >
                <span>{cmd.label}</span>
                {cmd.hint && <span className="text-xs text-muted">{cmd.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
