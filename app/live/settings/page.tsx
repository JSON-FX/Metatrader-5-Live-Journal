'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Server, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { AccountListItem } from '../../lib/live-types';
import AccountForm from '../../components/live/AccountForm';
import AccountList from '../../components/live/AccountList';
import EmptyState from '../../components/shared/EmptyState';

type FormMode = { type: 'closed' } | { type: 'add' } | { type: 'edit'; account: AccountListItem; endpoint: string; ruleId: number | null };

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [formMode, setFormMode] = useState<FormMode>({ type: 'closed' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<{ id: number; name: string }[]>([]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/live/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetch('/api/live/rules').then(r => r.json()).then(d => setRules(d.rules ?? [])).catch(() => {});
  }, []);

  async function handleSave(data: { slug: string; name: string; type: 'live' | 'propfirm'; endpoint: string; rule_id: number | null }) {
    setSaving(true);
    setFormError(null);

    try {
      const isEdit = formMode.type === 'edit';
      const url = isEdit ? `/api/live/accounts/${formMode.account.id}` : '/api/live/accounts';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? 'Failed to save account');
        setSaving(false);
        return;
      }

      setFormMode({ type: 'closed' });
      await fetchAccounts();
    } catch {
      setFormError('Network error — could not save account');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/live/accounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAccounts();
      }
    } catch {
      // silently fail
    }
  }

  async function handleEdit(account: AccountListItem) {
    setFormError(null);
    try {
      const res = await fetch(`/api/live/accounts/${account.id}/detail`);
      if (res.ok) {
        const detail = await res.json();
        setFormMode({ type: 'edit', account, endpoint: detail.endpoint, ruleId: detail.rule_id ?? null });
      }
    } catch {
      setFormError('Could not load account details');
    }
  }

  if (loading) return null;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.5px]">Account Settings</h2>
          <p className="text-xs text-text-muted mt-0.5">Manage your MT5 account connections</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/live/rules" className="text-sm text-accent hover:text-accent/80 transition-colors">
            Manage Rule Sets
          </Link>
          {accounts.length > 0 && formMode.type === 'closed' && (
            <button
              onClick={() => { setFormMode({ type: 'add' }); setFormError(null); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          )}
        </div>
      </div>

      {formMode.type !== 'closed' && (
        <AccountForm
          rules={rules}
          initial={formMode.type === 'edit' ? {
            slug: formMode.account.slug,
            name: formMode.account.name,
            type: formMode.account.type,
            endpoint: formMode.endpoint,
            rule_id: formMode.ruleId,
          } : undefined}
          onSave={handleSave}
          onCancel={() => setFormMode({ type: 'closed' })}
          saving={saving}
          error={formError}
        />
      )}

      {accounts.length === 0 && formMode.type === 'closed' ? (
        <EmptyState
          icon={Server}
          title="No accounts configured"
          description="Add an MT5 account to connect to your trading terminal."
          action={{ label: 'Add Account', onClick: () => { setFormMode({ type: 'add' }); setFormError(null); } }}
        />
      ) : accounts.length > 0 ? (
        <AccountList
          accounts={accounts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : null}

      <SetupGuide nextPort={nextAvailablePort(accounts)} />
      <NewVpsSetup />

      <div className="pt-2">
        <Link
          href="/live"
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </main>
  );
}

function nextAvailablePort(accounts: AccountListItem[]): number {
  // Parse ports from known endpoint pattern, suggest next one
  const ports = accounts
    .map(a => {
      // AccountListItem doesn't have endpoint, but we can infer from count
      return 5555 + accounts.indexOf(a);
    });
  return 5555 + accounts.length;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-bg-tertiary text-text-muted hover:text-text-primary hover:bg-border transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="relative group">
      <CopyButton text={children.trim()} />
      <pre className="bg-bg-primary border border-border rounded-lg px-4 py-3 text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap">
        {children.trim()}
      </pre>
    </div>
  );
}

function SetupGuide({ nextPort }: { nextPort: number }) {
  const [open, setOpen] = useState(false);

  const batScript = `@echo off
REM ─── New Account Bridge ───────────────────────
set MT5_LOGIN=YOUR_ACCOUNT_NUMBER
set MT5_PATH=C:\\Program Files\\YOUR_BROKER MT5 Terminal\\terminal64.exe
set MT5_SERVER=YOUR_BROKER_SERVER
set MT5_PASSWORD=YOUR_PASSWORD
set FLASK_PORT=${nextPort}

echo Starting MT5 bridge on port %FLASK_PORT%...
python mt5_api.py
pause`;

  const plistReload = `launchctl unload ~/Library/LaunchAgents/com.jsonfx.mt5tunnel.plist
launchctl load ~/Library/LaunchAgents/com.jsonfx.mt5tunnel.plist`;

  const endpoint = `http://host.docker.internal:${nextPort}`;

  return (
    <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-bg-tertiary/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-text-primary">How to add a new account</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold shrink-0">1</span>
              <h4 className="text-sm font-medium text-text-primary">Start a Flask bridge on the VPS</h4>
            </div>
            <p className="text-xs text-text-muted ml-8.5 pl-0.5">
              On the Windows VPS, create a new <code className="bg-bg-primary px-1 py-0.5 rounded text-text-secondary">.bat</code> file
              in <code className="bg-bg-primary px-1 py-0.5 rounded text-text-secondary">C:\Users\Administrator\Documents\vps-bridge\</code> with
              the following content. Replace the values with your account details:
            </p>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{batScript}</CodeBlock>
            </div>
            <p className="text-xs text-text-muted ml-8.5 pl-0.5">
              Double-click the <code className="bg-bg-primary px-1 py-0.5 rounded text-text-secondary">.bat</code> file to start the bridge.
              Keep the terminal window open.
            </p>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold shrink-0">2</span>
              <h4 className="text-sm font-medium text-text-primary">Add SSH tunnel for the new port</h4>
            </div>
            <p className="text-xs text-text-muted ml-8.5 pl-0.5">
              Edit the SSH tunnel config on your Mac. Open this file:
            </p>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>~/Library/LaunchAgents/com.jsonfx.mt5tunnel.plist</CodeBlock>
            </div>
            <p className="text-xs text-text-muted ml-8.5 pl-0.5">
              Find the existing <code className="bg-bg-primary px-1 py-0.5 rounded text-text-secondary">-L</code> lines
              and add these two lines right after them (before the <code className="bg-bg-primary px-1 py-0.5 rounded text-text-secondary">Administrator@</code> line):
            </p>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{`<string>-L</string>\n<string>${nextPort}:127.0.0.1:${nextPort}</string>`}</CodeBlock>
            </div>
            <p className="text-xs text-text-muted ml-8.5 pl-0.5">
              Then reload the tunnel by running this in Terminal:
            </p>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{plistReload}</CodeBlock>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold shrink-0">3</span>
              <h4 className="text-sm font-medium text-text-primary">Add the account here</h4>
            </div>
            <p className="text-xs text-text-muted ml-8.5 pl-0.5">
              Click <strong>Add Account</strong> above and use this endpoint:
            </p>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{endpoint}</CodeBlock>
            </div>
            <p className="text-xs text-text-muted ml-8.5 pl-0.5">
              The account should show as <span className="text-profit font-medium">Online</span> within a few seconds.
              If it shows Offline, check that the Flask bridge is running on the VPS and the SSH tunnel includes port {nextPort}.
            </p>
          </div>

          {/* Port reference */}
          <div className="bg-bg-primary border border-border rounded-lg px-4 py-3 ml-8.5 pl-4">
            <p className="text-xs text-text-muted">
              <strong className="text-text-secondary">Port reference:</strong> Each account needs a unique port.
              Your next available port is <code className="bg-bg-tertiary px-1 py-0.5 rounded text-text-primary font-bold">{nextPort}</code>.
              The commands above already use this port.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function NewVpsSetup() {
  const [open, setOpen] = useState(false);

  const firewallRule = `New-NetFirewallRule -DisplayName "Allow SSH Inbound Port 2222" -Direction Inbound -Protocol TCP -LocalPort 2222 -Action Allow`;

  const installSsh = `Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0`;

  const configureSsh = `# Set SSH to start automatically
Set-Service -Name sshd -StartupType Automatic

# Start SSH now
Start-Service sshd

# Change SSH port to 2222 — edit the config file:
notepad C:\\ProgramData\\ssh\\sshd_config
# Find the line "#Port 22" and change it to:
# Port 2222
# Save and close, then restart SSH:
Restart-Service sshd`;

  const installPython = `# Download and install Python 3.10+ from https://python.org
# Then install dependencies:
pip install MetaTrader5 Flask flask-cors`;

  const copyBridge = `# Copy the vps-bridge folder to:
C:\\Users\\Administrator\\Documents\\vps-bridge\\`;

  const genSshKey = `# Run this on your Mac to generate an SSH key:
ssh-keygen -t ed25519 -f ~/.ssh/mt5_tunnel -N ""

# Copy the public key to the VPS — run this on your Mac:
cat ~/.ssh/mt5_tunnel.pub
# Then on the VPS, paste it into:
# C:\\Users\\Administrator\\.ssh\\authorized_keys`;

  const plistTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.jsonfx.mt5tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/autossh</string>
    <string>-M</string>
    <string>0</string>
    <string>-N</string>
    <string>-i</string>
    <string>/Users/jsonse/.ssh/mt5_tunnel</string>
    <string>-p</string>
    <string>2222</string>
    <string>-o</string>
    <string>ServerAliveInterval=30</string>
    <string>-o</string>
    <string>ServerAliveCountMax=3</string>
    <string>-o</string>
    <string>StrictHostKeyChecking=no</string>
    <string>-o</string>
    <string>ExitOnForwardFailure=yes</string>
    <string>-L</string>
    <string>5555:127.0.0.1:5555</string>
    <string>Administrator@YOUR_VPS_IP</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>/tmp/mt5tunnel.log</string>
</dict>
</plist>`;

  const loadPlist = `# Install autossh if not already installed:
brew install autossh

# Load the tunnel (starts automatically on boot):
launchctl load ~/Library/LaunchAgents/com.jsonfx.mt5tunnel.plist`;

  return (
    <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-bg-tertiary/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-text-primary">New VPS setup (first-time only)</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
          <p className="text-xs text-text-muted">
            Run these steps once when setting up a new Forex VPS. Connect to the VPS via RDP first, then open PowerShell as Administrator.
          </p>

          {/* Step 1: Install OpenSSH */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold shrink-0">1</span>
              <h4 className="text-sm font-medium text-text-primary">Install OpenSSH Server (on VPS via PowerShell)</h4>
            </div>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{installSsh}</CodeBlock>
            </div>
          </div>

          {/* Step 2: Configure SSH */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold shrink-0">2</span>
              <h4 className="text-sm font-medium text-text-primary">Configure SSH on port 2222 (on VPS via PowerShell)</h4>
            </div>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{configureSsh}</CodeBlock>
            </div>
          </div>

          {/* Step 3: Firewall rule */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold shrink-0">3</span>
              <h4 className="text-sm font-medium text-text-primary">Add firewall rule for SSH (on VPS via PowerShell)</h4>
            </div>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{firewallRule}</CodeBlock>
            </div>
          </div>

          {/* Step 4: Install Python */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold shrink-0">4</span>
              <h4 className="text-sm font-medium text-text-primary">Install Python and dependencies (on VPS)</h4>
            </div>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{installPython}</CodeBlock>
            </div>
          </div>

          {/* Step 5: Copy bridge */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold shrink-0">5</span>
              <h4 className="text-sm font-medium text-text-primary">Copy the vps-bridge folder to VPS</h4>
            </div>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{copyBridge}</CodeBlock>
            </div>
            <p className="text-xs text-text-muted ml-8.5 pl-0.5">
              Copy the <code className="bg-bg-primary px-1 py-0.5 rounded text-text-secondary">vps-bridge/</code> folder
              from this project to the VPS via RDP (drag and drop or shared clipboard).
            </p>
          </div>

          {/* Step 6: SSH key */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold shrink-0">6</span>
              <h4 className="text-sm font-medium text-text-primary">Set up SSH key authentication (on Mac)</h4>
            </div>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{genSshKey}</CodeBlock>
            </div>
          </div>

          {/* Step 7: Create autossh plist */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold shrink-0">7</span>
              <h4 className="text-sm font-medium text-text-primary">Create persistent SSH tunnel (on Mac)</h4>
            </div>
            <p className="text-xs text-text-muted ml-8.5 pl-0.5">
              Save this as <code className="bg-bg-primary px-1 py-0.5 rounded text-text-secondary">~/Library/LaunchAgents/com.jsonfx.mt5tunnel.plist</code> — replace <code className="bg-bg-primary px-1 py-0.5 rounded text-text-secondary">YOUR_VPS_IP</code> with your VPS IP address:
            </p>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{plistTemplate}</CodeBlock>
            </div>
            <p className="text-xs text-text-muted ml-8.5 pl-0.5">
              Then load it:
            </p>
            <div className="ml-8.5 pl-0.5">
              <CodeBlock>{loadPlist}</CodeBlock>
            </div>
          </div>

          {/* Done */}
          <div className="bg-bg-primary border border-border rounded-lg px-4 py-3 ml-8.5 pl-4">
            <p className="text-xs text-text-muted">
              <strong className="text-text-secondary">Done!</strong> Your VPS is now ready.
              Follow the &quot;How to add a new account&quot; guide above to connect your first MT5 account.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
