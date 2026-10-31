import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
export default function SessionTerminal() {
  const element = useRef(null);
  const [status, setStatus] = useState('Connecting…');
  useEffect(() => {
    const terminal = new Terminal({ cursorBlink: true, fontFamily: 'Consolas, monospace', fontSize: 14, theme: { background: '#13251e', foreground: '#e2f0e6' } });
    const fit = new FitAddon(); terminal.loadAddon(fit); terminal.open(element.current); fit.fit(); terminal.focus();
    const off = window.shelllight.onSession(event => {
      if (event.type === 'data') terminal.write(new Uint8Array(event.data));
      if (event.type === 'ready') { setStatus('Connected'); window.shelllight.sessionResize(terminal.cols, terminal.rows); }
      if (event.type === 'error') { setStatus('Connection failed'); terminal.writeln('\r\n' + event.message); }
      if (event.type === 'close') { setStatus(s => s === 'Connection failed' ? s : 'Disconnected'); terminal.writeln('\r\n[Session ended]'); }
    });
    const input = terminal.onData(data => window.shelllight.sessionInput(data));
    const observer = new ResizeObserver(() => { fit.fit(); window.shelllight.sessionResize(terminal.cols, terminal.rows); }); observer.observe(element.current);
    window.shelllight.sessionStart().catch(e => { setStatus('Connection failed'); terminal.writeln(e.message); });
    return () => { off(); input.dispose(); observer.disconnect(); terminal.dispose(); };
  }, []);
  return <div className="session-screen"><div className="session-bar"><strong>ShellLight · Secure session</strong><span>{status}</span></div><div className="session-terminal" ref={element}/></div>;
}
