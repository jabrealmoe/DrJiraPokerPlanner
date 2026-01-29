import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import DonkeyKongJr from './DonkeyKongJr';

const ADMIN_DEFAULTS = {
  deckType: 'FIBONACCI',
  customDeck: '1,2,3,5,8,13,20,40,100',
  whoCanReveal: 'MODERATOR', // ANY, MODERATOR, ASSIGNEE
  autoReveal: false,
  autoRevealSeconds: 0,
  autoRevealSeconds: 0
};

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 32, background: 'var(--surface)', padding: 24, borderRadius: 8, border: 'var(--border)' }}>
    <h3 style={{ marginTop: 0, marginBottom: 16, color: 'var(--primary)' }}>{title}</h3>
    {children}
  </div>
);

const AdminPage = () => {
  const [config, setConfig] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error'
  const [showGame, setShowGame] = useState(false);

  useEffect(() => {
    invoke('getAppConfig').then(data => {
      setConfig(data || ADMIN_DEFAULTS);
    });
  }, []);

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      console.log('Saving config:', config);
      await invoke('saveAppConfig', { config });
      setStatus('success');
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
    setIsSaving(false);
  };

  const handleClearSessions = async () => {
    if (confirm("⚠️ ARE YOU SURE? This will warn-delete all active poker sessions across the entire Jira site. This cannot be undone.")) {
       const res = await invoke('clearAllSessions');
       alert(`Deleted ${res.count} sessions.`);
    }
  };

  if (!config) return <div style={{ color: 'white', padding: 20 }}>Loading Settings...</div>;

  return (
    <div className="app-container" style={{ display: 'block', maxWidth: 800, margin: '0 auto', overflowY: 'auto' }}>
      <header style={{ marginBottom: 40, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 20 }}>
        <h1 style={{ fontSize: '2rem' }}>Poker Planning Settings</h1>
        <p style={{ color: 'var(--text-muted)' }}>Configure Planning Poker behavior for your organization.</p>
      </header>

      <Section title="1. Deck Configuration">
        <label style={{ display: 'block', marginBottom: 8 }}>Default Estimation Deck</label>
        <select 
          className="modern-select"
          value={config.deckType} 
          onChange={(e) => handleChange('deckType', e.target.value)}
        >
          <option value="FIBONACCI">Fibonacci (0, 1, 2, 3, 5...)</option>
          <option value="TSHIRT">T-Shirt Sizes (XS, S, M, L...)</option>
          <option value="CUSTOM">Custom Deck</option>
        </select>

        {config.deckType === 'CUSTOM' && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>Comma-separated values</label>
            <input 
              type="text" 
              className="modern-input"
              value={config.customDeck} 
              onChange={(e) => handleChange('customDeck', e.target.value)}
              placeholder="e.g. 1, 2, 3, 5, 8"
            />
          </div>
        )}
      </Section>

      <Section title="2. Permissions">
        <label style={{ display: 'block', marginBottom: 8 }}>Who can reveal votes?</label>
        <div style={{ display: 'flex', gap: 16 }}>
          {['ANY', 'MODERATOR', 'ASSIGNEE'].map(role => (
            <label key={role} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <input 
                type="radio" 
                name="whoCanReveal"
                checked={config.whoCanReveal === role}
                onChange={() => handleChange('whoCanReveal', role)}
                style={{ marginRight: 8 }}
              />
              {role.charAt(0) + role.slice(1).toLowerCase()}
            </label>
          ))}
        </div>
      </Section>



      <Section title="3. Break Time">
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: 16, cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={showGame} 
            onChange={(e) => setShowGame(e.target.checked)}
            style={{ marginRight: 12 }}
          />
          Show Secret Arcade
        </label>
        
        {showGame && (
           <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
             <DonkeyKongJr />
           </div>
        )}
      </Section>

      <Section title="Danger Zone">
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
           If sessions are stuck or data is corrupted, you can wipe all active poker data from the database.
        </p>
        <button 
           onClick={handleClearSessions}
           style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 4, cursor: 'pointer' }}
        >
          🗑️ Clear All Session Data
        </button>
      </Section>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-gradient)', padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
         {status === 'success' && <span style={{ color: '#34d399', alignSelf: 'center' }}>Settings Saved! ✅</span>}
         {status === 'error' && <span style={{ color: '#ef4444', alignSelf: 'center' }}>Save Failed ❌</span>}
         
         <button 
           onClick={handleSave}
           disabled={isSaving}
           className="reveal-btn"
           style={{ borderRadius: 6, fontSize: '1rem', padding: '12px 32px' }}
         >
           {isSaving ? 'Saving...' : 'Save Configuration'}
         </button>
      </div>
      <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)', fontSize: '0.8rem', opacity: 0.7 }}>
        v{process.env.REACT_APP_VERSION || '0.0.0-dev'}
      </div>
    </div>
  );
};

export default AdminPage;
