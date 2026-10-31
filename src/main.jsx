import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Terminal, Layers, Plus, Search, ArrowUpRight, KeyRound, LockKeyhole, Star, MoreHorizontal, X, FolderOpen, ChevronRight, Server, Download, Pencil, Trash2, Copy, Clock3, Check, ShieldCheck } from 'lucide-react';
import './style.css';
import SessionTerminal from './Terminal';

const empty = { version: 1, environments: [], connections: [] };
const authNames = { default: 'SSH config', key: 'Private key', password: 'Password', agent: 'SSH agent' };
const colors = ['green', 'blue', 'amber', 'purple', 'red'];
const makeConnection = environmentId => ({ name: '', host: '', username: '', port: '22', auth: 'default', keyPath: '', jumpHost: '', environmentId, favorite: false });
function App() {
  const [data, setData] = useState(empty);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [agentState, setAgentState] = useState(null);
  const [password, setPassword] = useState('');
  const closeModal = () => { setPassword(''); setModal(null); };
  useEffect(() => { if (modal === 'connection' && ['key', 'agent'].includes(draft.auth)) window.shelllight?.agentStatus().then(setAgentState).catch(() => setAgentState(null)); }, [modal, draft.auth]);
  useEffect(() => { if (!window.shelllight) { setError('Open ShellLight using npm start to access desktop features.'); return; } window.shelllight.load().then(d => { setData(d); setLoaded(true); }).catch(e => setError(e.message)); }, []);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 4200); return () => clearTimeout(timer); } }, [toast]);
  useEffect(() => { const handle = e => { if (e.key === 'Escape' && !busy) closeModal(); }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle); }, [busy]);
  async function save(next, credential) { const persisted = await window.shelllight.save(next, credential); setData(persisted); }
  async function action(fn) { setError(''); setBusy(true); try { await fn(); } catch (e) { setError(e.message.replace(/^Error invoking remote method '[^']+': Error: /, '')); } finally { setBusy(false); } }
  const current = data.environments.find(e => e.id === selected);
  const visible = data.connections.filter(c => (selected === 'all' || selected === 'favorites' && c.favorite || selected === 'recent' && c.lastUsed || c.environmentId === selected) && `${c.name} ${c.host} ${c.username}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => selected === 'recent' ? (b.lastUsed || '').localeCompare(a.lastUsed || '') : a.name.localeCompare(b.name));
  const openEnvironment = e => { setDraft(e || { name: '', color: 'green' }); setModal('environment'); };
  const openConnection = c => { if (!data.environments.length) { openEnvironment(); return; } setPassword(''); setDraft(c || makeConnection(current?.id || data.environments[0].id)); setModal('connection'); };
  const update = (key, value) => {
    if (key === 'auth' || key === 'rememberPassword' && !value) setPassword('');
    setDraft(d => ({ ...d, [key]: value }));
  };
  async function submit(e) {
    e.preventDefault();
    await action(async () => {
      if (modal === 'environment') {
        const env = { ...draft, name: draft.name.trim(), id: draft.id || crypto.randomUUID() };
        if (data.environments.some(e => e.id !== env.id && e.name.toLowerCase() === env.name.toLowerCase())) throw new Error('An environment with this name already exists.');
        await save({ ...data, environments: [...data.environments.filter(e => e.id !== env.id), env] }); setSelected(env.id);
      } else {
        const connection = { ...draft, rememberPassword: draft.auth === 'password' && !!draft.rememberPassword, name: draft.name.trim(), host: draft.host.trim(), username: draft.username.trim(), jumpHost: draft.jumpHost.trim(), id: draft.id || crypto.randomUUID() };
        await save({ ...data, connections: [...data.connections.filter(c => c.id !== connection.id), connection] }, password && connection.rememberPassword ? { id: connection.id, password } : undefined);
        setPassword('');
      }
      closeModal(); setToast('Saved. Ready when you are.');
    });
  }
  async function importSSH() { await action(async () => {
    const imported = await window.shelllight.importSSH(); if (imported === null) return;
    const env = current || data.environments.find(e => e.name === 'Imported') || { id: crypto.randomUUID(), name: 'Imported', color: 'blue' };
    const fresh = imported.filter((c, i) => !data.connections.some(x => x.host === c.host && x.environmentId === env.id) && imported.findIndex(x => x.host === c.host) === i).map(c => ({ ...c, id: crypto.randomUUID(), environmentId: env.id }));
    if (!fresh.length) { setToast('No new explicit Host aliases found.'); return; }
    await save({ ...data, environments: data.environments.some(e => e.id === env.id) ? data.environments : [...data.environments, env], connections: [...data.connections, ...fresh] }); setSelected(env.id); setToast(`Imported ${fresh.length} connections. SSH config handles authentication.`);
  }); }
  async function connect(c) { await action(async () => { await window.shelllight.connect(c.id); setToast(`Terminal opened for ${c.name}. Complete authentication there.`); await save({ ...data, connections: data.connections.map(x => x.id === c.id ? { ...x, lastUsed: new Date().toISOString() } : x) }); }); }
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><Terminal size={23}/></span>shell<span>light</span><small>DESKTOP</small></div>
      <div className="workspace"><span className="avatar">W</span><div>My workspace<small>Local configuration</small></div><ShieldCheck size={16}/></div>
      <div className="nav-label">WORKSPACE</div>
      <button className={`nav ${selected === 'all' ? 'active' : ''}`} onClick={() => setSelected('all')}><Layers size={18}/>All connections<span>{data.connections.length}</span></button>
      <button className={`nav ${selected === 'favorites' ? 'active' : ''}`} onClick={() => setSelected('favorites')}><Star size={18}/>Favorites<span>{data.connections.filter(c => c.favorite).length}</span></button>
      <button className={`nav ${selected === 'recent' ? 'active' : ''}`} onClick={() => setSelected('recent')}><Clock3 size={18}/>Recent sessions</button>
      <div className="nav-label env-label">ENVIRONMENTS<button title="Add environment" aria-label="Add environment" onClick={() => openEnvironment()}><Plus size={16}/></button></div>
      {data.environments.map(e => <button key={e.id} className={`nav ${selected === e.id ? 'active' : ''}`} onClick={() => setSelected(e.id)}><i className={`dot ${e.color}`}/>{e.name}<span>{data.connections.filter(c => c.environmentId === e.id).length}</span></button>)}
      <button className="add-env" onClick={() => openEnvironment()}><Plus size={16}/>New environment</button>
      <div className="sidebar-bottom"><div className="local-indicator"><i className="dot green"/>Stored on your device</div><p>Your keys stay yours.<br/>Your workflow stays simple.</p><span>ShellLight <b>v1.1</b></span></div>
    </aside>
    <main>
      <header><div>Workspace<ChevronRight size={14}/><strong>{current?.name || (selected === 'all' ? 'All connections' : selected === 'favorites' ? 'Favorites' : 'Recent sessions')}</strong></div><span><span className="status-dot"/>Local workspace</span></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">LESS TYPING. MORE DOING.</div><h1>{current?.name || (selected === 'favorites' ? 'Your favorites' : selected === 'recent' ? 'Recent sessions' : 'Your connections')}<span className="heading-dot">.</span></h1><p>Your environments, organized. Your next session, one click away.</p></div><button className="primary" onClick={() => openConnection()} disabled={!loaded || busy}><Plus size={17}/>Add connection</button></div>
        <div className="stats"><div><span className="stat-icon"><Server size={20}/></span><div><strong>{data.connections.length}</strong><span>Saved connections</span></div></div><div><span className="stat-icon blue-tint"><Layers size={20}/></span><div><strong>{data.environments.length}</strong><span>Environments</span></div></div><div><span className="stat-icon amber-tint"><KeyRound size={20}/></span><div><strong>{data.connections.filter(c => c.auth === 'key').length}</strong><span>Key-based connections</span></div></div></div>
        <section className="connection-section"><div className="toolbar"><div className="search"><Search size={18}/><input aria-label="Search connections" placeholder="Search connections, hosts, or users…" value={search} onChange={e => setSearch(e.target.value)}/></div><button className="secondary" disabled={!loaded || busy} onClick={importSSH}><Download size={16}/>Import SSH config</button>{current && <><button className="icon-button" aria-label="Edit environment" title="Edit environment" onClick={() => openEnvironment(current)}><Pencil size={17}/></button><button className="icon-button" aria-label="Delete environment" title="Delete environment" onClick={() => { setDraft(current); setModal('delete-environment'); }}><Trash2 size={17}/></button></>}</div>
          <div className="section-label"><h2>{current ? `${current.name} connections` : 'Connections'}<span>{visible.length}</span></h2><span>ONE CLICK TO YOUR NEXT SESSION</span></div>
          {!visible.length ? <div className="empty"><div className="empty-icon"><Terminal size={32}/></div><h2>{search ? 'No matching connections' : 'A little setup. A faster every day.'}</h2><p>{search ? 'Try a different name, host, or username.' : data.environments.length ? 'Add your first VM and choose how you authenticate.' : 'Start with an environment, then add the VMs you work with.'}</p>{!search && <button className="primary" disabled={!loaded} onClick={() => data.environments.length ? openConnection() : openEnvironment()}><Plus size={17}/>{data.environments.length ? 'Add connection' : 'Create your first environment'}</button>}<span className="empty-foot">No commands to remember. No keys to copy.</span></div> : <div className="cards">{visible.map(c => { const env = data.environments.find(e => e.id === c.environmentId); return <article className="card" key={c.id}><div className="card-top"><span className={`server-icon ${env.color}`}><Server size={22}/></span><span className={`badge ${env.color}`}>{env.name}</span><button className={`icon-button favorite ${c.favorite ? 'is-favorite' : ''}`} aria-label={c.favorite ? 'Remove favorite' : 'Add favorite'} onClick={() => action(() => save({ ...data, connections: data.connections.map(x => x.id === c.id ? { ...x, favorite: !x.favorite } : x) }))}><Star size={17} fill={c.favorite ? 'currentColor' : 'none'}/></button></div><h3>{c.name}</h3><div className="host">{c.host}{String(c.port) !== '22' ? `:${c.port}` : ''}</div><div className="connection-details"><span>{c.username || 'Default user'}</span><span>{c.auth === 'password' ? <LockKeyhole size={13}/> : <KeyRound size={13}/>} {authNames[c.auth]}</span></div><div className="card-footer"><button className="connect" disabled={busy} onClick={() => connect(c)}>Connect<ArrowUpRight size={16}/></button><button className="icon-button" title="Edit connection" aria-label={`Edit ${c.name}`} onClick={() => openConnection(c)}><Pencil size={16}/></button><button className="icon-button" title="Duplicate connection" aria-label={`Duplicate ${c.name}`} onClick={() => openConnection({ ...c, id: undefined, name: `${c.name} copy`, lastUsed: undefined })}><Copy size={15}/></button><button className="icon-button" title="Delete connection" aria-label={`Delete ${c.name}`} onClick={() => { setDraft(c); setModal('delete-connection'); }}><Trash2 size={16}/></button></div></article>; })}</div>}
        </section><footer><ShieldCheck size={15}/><span>Private keys stay on your device. Authentication happens in your terminal.</span><span>BUILT FOR YOUR DAILY WORKFLOW</span></footer>
      </div>
    </main>
    {error && <div className="error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
    {modal && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) closeModal(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><div className="eyebrow">YOUR WORKSPACE, YOUR WAY</div><h2 id="modal-title">{modal.startsWith('delete') ? 'Delete ' + (modal === 'delete-environment' ? 'environment' : 'connection') + '?' : `${draft.id ? 'Edit' : 'New'} ${modal}`}</h2></div><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={() => closeModal()}><X size={20}/></button></div>
      {modal.startsWith('delete') ? <><p className="delete-message">Delete “{draft.name}”? {modal === 'delete-environment' ? 'All saved connections in this environment will also be removed.' : 'You can add this connection again later.'}</p><div className="modal-actions"><button className="secondary" disabled={busy} onClick={() => closeModal()}>Cancel</button><button className="danger" disabled={busy} onClick={() => action(async () => { await save({ ...data, environments: modal === 'delete-environment' ? data.environments.filter(e => e.id !== draft.id) : data.environments, connections: data.connections.filter(c => modal === 'delete-environment' ? c.environmentId !== draft.id : c.id !== draft.id) }); if (modal === 'delete-environment') setSelected('all'); closeModal(); })}>Delete</button></div></> : <form onSubmit={submit}>
        <label>{modal === 'environment' ? 'Environment name' : 'Connection name'}<input autoFocus required maxLength={modal === 'environment' ? 60 : 100} placeholder={modal === 'environment' ? 'e.g. Staging' : 'e.g. Backend API'} value={draft.name} onChange={e => update('name', e.target.value)}/></label>
        {modal === 'environment' ? <><label>Environment color</label><div className="color-options">{colors.map(color => <button type="button" key={color} className={`color-choice ${color} ${draft.color === color ? 'chosen' : ''}`} aria-label={color} aria-pressed={draft.color === color} onClick={() => update('color', color)}>{draft.color === color && <Check size={18}/>}</button>)}</div><p className="form-note">Group your VMs by environment, project, or team.</p></> : <>
          <label>Environment<select value={draft.environmentId} onChange={e => update('environmentId', e.target.value)}>{data.environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
          <div className="form-row"><label className="grow">Host / IP / SSH alias<input required placeholder="10.0.1.20 or my-server" value={draft.host} onChange={e => update('host', e.target.value)}/></label><label className="port">Port<input required type="number" min="1" max="65535" value={draft.port} onChange={e => update('port', e.target.value)}/></label></div>
          <label>Username <small>optional · uses SSH defaults when empty</small><input placeholder="ubuntu" value={draft.username} onChange={e => update('username', e.target.value)}/></label>
          <label>Authentication<select value={draft.auth} onChange={e => update('auth', e.target.value)}><option value="default">Default / SSH config</option><option value="key">Private key file</option><option value="password">Password (no key required)</option><option value="agent">SSH agent</option></select></label>
          {draft.auth === 'password' && <div className="agent-panel"><label className="remember-option"><input type="checkbox" checked={!!draft.rememberPassword} onChange={e => update('rememberPassword', e.target.checked)}/>Remember password on this computer</label>{draft.rememberPassword && <label>Password<input type="password" autoComplete="new-password" value={password} placeholder={draft.id ? 'Leave blank to keep the saved password' : 'Enter your VM password'} onChange={e => setPassword(e.target.value)}/></label>}<p>{draft.rememberPassword ? 'Stored in Windows Credential Manager. Opens a terminal inside ShellLight. Use a direct host/IP and username; SSH config aliases, jump hosts, and MFA are not supported for saved-password sessions.' : 'Password is requested in Windows Terminal each time.'}</p>{draft.rememberPassword && <small>To forget the password, uncheck this option and save. Changing host, port, or username requires entering the password again.</small>}</div>}
          {draft.auth === 'key' && <label>Private key file<div className="key-picker"><input required placeholder="Select your private key…" value={draft.keyPath} onChange={e => update('keyPath', e.target.value)}/><button type="button" className="secondary" aria-label="Browse for private key" onClick={() => action(async () => { const file = await window.shelllight.pickKey(); if (file) update('keyPath', file); })}><FolderOpen size={18}/></button></div></label>}
          {['key', 'agent'].includes(draft.auth) && <div className="agent-panel"><strong>Skip repeated passphrase prompts</strong><p>Enable Windows SSH Agent, then unlock your key once. Future connections reuse it while the agent has it loaded.</p><div className="agent-actions"><span>{agentState?.running ? '● Agent running' : agentState ? `Agent: ${agentState.service}` : 'Agent status unavailable'}</span><button type="button" className="secondary" disabled={busy} onClick={() => action(async () => { setAgentState(await window.shelllight.setupAgent()); setToast('SSH Agent enabled. Now unlock your key.'); })}>{agentState?.running ? 'Enable auto-start' : 'Enable SSH Agent'}</button>{draft.auth === 'key' && <button type="button" className="primary" disabled={busy || !draft.keyPath || !agentState?.running} onClick={() => action(async () => { setToast('Enter the passphrase in the key unlock window.'); await window.shelllight.unlockKey(draft.keyPath); setToast('Key added to SSH Agent. You can connect without another passphrase prompt.'); })}><KeyRound size={14}/>{busy ? 'Working…' : 'Unlock key'}</button>}</div><small>Agent setup requests Windows administrator approval. Unlocking runs as your normal account; the app never receives your passphrase.{draft.auth === 'agent' && ' To load a key, choose Private key file, select it, and click Unlock key.'}</small></div>}
          <p className="form-note">{draft.auth === 'key' ? 'Only the file path is saved. Encrypted keys prompt unless already available in your agent.' : draft.auth === 'password' ? 'Remembered passwords stay in Windows Credential Manager, separate from connection settings.' : draft.auth === 'agent' ? 'Uses keys already loaded into your running SSH agent.' : 'OpenSSH uses your existing SSH configuration, keys, and authentication defaults.'}</p>
          <label>Jump host <small>optional</small><input placeholder="bastion-alias or user@bastion:22" value={draft.jumpHost} onChange={e => update('jumpHost', e.target.value)}/></label>
        </>}
        <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={() => closeModal()}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save ' + modal}</button></div>
      </form>}
    </div></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('terminal') ? <SessionTerminal/> : <App/>);
