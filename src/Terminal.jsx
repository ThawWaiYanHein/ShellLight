import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

export default function SessionTerminal({ sessionId, active, onStatus, onPasteReady, onCopyReady }) {
  const element = useRef(null);
  const terminalRef = useRef(null);
  const resizeTerminalRef = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const [status, setStatus] = useState('Connecting...');
  useEffect(() => {
    const terminal = new Terminal({ cursorBlink: true, scrollOnUserInput: true, fontFamily: 'Consolas, monospace', fontSize: 14, scrollback: 1000, theme: { background: '#000000', foreground: '#83c594' } });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(element.current);
    let webgl;
    let webglContextLoss;
    try {
      webgl = new WebglAddon();
      terminal.loadAddon(webgl);
      webglContextLoss = webgl.onContextLoss(() => webgl.dispose());
    } catch { webgl?.dispose(); }
    terminalRef.current = terminal;
    let pendingOutputAck = 0;
    const acknowledgeOutput = size => {
      pendingOutputAck += size;
      if (pendingOutputAck >= 32768) {
        window.shelllight.sessionOutputAck(sessionId, pendingOutputAck);
        pendingOutputAck = 0;
      }
    };
    const resizeTerminal = () => {
      fit.fit();
      // Leave a small breathing margin below the prompt while keeping the
      // xterm surface and scrollbar full-height.
      const visibleRows = Math.max(5, terminal.rows - 4);
      if (visibleRows !== terminal.rows) terminal.resize(terminal.cols, visibleRows);
      window.shelllight.sessionResize(sessionId, terminal.cols, terminal.rows);
    };
    resizeTerminalRef.current = resizeTerminal;
    const off = window.shelllight.onSession(sessionId, event => {
      if (event.type === 'data') {
        const data = typeof event.data === 'string' || event.data instanceof Uint8Array ? event.data : new Uint8Array(event.data);
        terminal.write(data, () => acknowledgeOutput(event.size));
      }
      if (event.type === 'ready') { setStatus('Connected'); resizeTerminal(); }
      if (event.type === 'error') { setStatus('Connection failed'); terminal.writeln('\r\n' + event.message); }
      if (event.type === 'close') { setStatus(s => s === 'Connection failed' ? s : 'Disconnected'); terminal.writeln('\r\n[Session ended]'); }
    });
    const paste = async () => { try { terminal.paste(await window.shelllight.sessionPaste(sessionId)); } catch (error) { terminal.writeln('\r\n' + error.message); } };
    const copySelection = async () => {
      const selection = terminal.getSelection();
      if (!selection) return;
      try { await window.shelllight.sessionCopy(sessionId, selection); }
      catch (error) { terminal.writeln('\r\n' + error.message); }
    };
    onPasteReady?.(sessionId, paste);
    onCopyReady?.(sessionId, copySelection);
    terminal.attachCustomKeyEventHandler(event => {
      const pasteShortcut = event.type === 'keydown' && ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' || event.shiftKey && event.key === 'Insert');
      if (pasteShortcut) { event.preventDefault(); paste(); return false; }
      const copyShortcut = event.type === 'keydown' && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && (terminal.hasSelection() || event.shiftKey);
      if (copyShortcut) { event.preventDefault(); copySelection(); return false; }
      return true;
    });
    const contextMenu = event => { event.preventDefault(); paste(); };
    terminal.element.addEventListener('contextmenu', contextMenu);
    const input = terminal.onData(data => window.shelllight.sessionInput(sessionId, data));
    const observer = new ResizeObserver(() => { if (activeRef.current) resizeTerminal(); });
    observer.observe(element.current);
    window.shelllight.sessionStart(sessionId).catch(error => { setStatus('Connection failed'); terminal.writeln(error.message); });
    return () => { onPasteReady?.(sessionId, null); onCopyReady?.(sessionId, null); off(); webglContextLoss?.dispose(); terminal.element.removeEventListener('contextmenu', contextMenu); input.dispose(); observer.disconnect(); terminal.dispose(); terminalRef.current = null; resizeTerminalRef.current = null; };
  }, [sessionId]);
  useEffect(() => {
    onStatus?.(sessionId, status);
    if (active) requestAnimationFrame(() => { resizeTerminalRef.current?.(); terminalRef.current?.focus(); });
  }, [active, status, sessionId]);
  return <div className={`session-screen ${active ? '' : 'inactive'}`}><div className="session-terminal" ref={element}/></div>;
}
