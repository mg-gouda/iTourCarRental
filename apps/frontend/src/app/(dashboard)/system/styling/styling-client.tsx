'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Palette, Sun, Moon, Save, RotateCcw } from 'lucide-react';

import { stylingApi, StylingProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Token definitions ──────────────────────────────────────────────────────────

const TOKEN_GROUPS = [
  {
    label: 'Brand',
    tokens: [
      { key: 'primary', label: 'Primary' },
      { key: 'primary-foreground', label: 'Primary text' },
      { key: 'ring', label: 'Focus ring' },
    ],
  },
  {
    label: 'Semantic',
    tokens: [
      { key: 'destructive', label: 'Destructive' },
      { key: 'destructive-foreground', label: 'Destructive text' },
      { key: 'success', label: 'Success' },
      { key: 'success-foreground', label: 'Success text' },
      { key: 'warning', label: 'Warning' },
      { key: 'warning-foreground', label: 'Warning text' },
    ],
  },
  {
    label: 'Surfaces',
    tokens: [
      { key: 'background', label: 'Background' },
      { key: 'foreground', label: 'Foreground' },
      { key: 'card', label: 'Card' },
      { key: 'card-foreground', label: 'Card text' },
      { key: 'muted', label: 'Muted' },
      { key: 'muted-foreground', label: 'Muted text' },
      { key: 'border', label: 'Border' },
    ],
  },
  {
    label: 'Sidebar',
    tokens: [
      { key: 'sidebar-background', label: 'Sidebar background' },
      { key: 'sidebar-foreground', label: 'Sidebar text' },
      { key: 'sidebar-primary', label: 'Sidebar primary' },
      { key: 'sidebar-accent', label: 'Sidebar hover' },
      { key: 'sidebar-border', label: 'Sidebar border' },
    ],
  },
] as const;

// CSS variable default values (from globals.css light mode)
const LIGHT_DEFAULTS: Record<string, string> = {
  'primary': '221 83% 53%',
  'primary-foreground': '0 0% 100%',
  'ring': '221 83% 53%',
  'destructive': '0 84% 60%',
  'destructive-foreground': '0 0% 100%',
  'success': '142 71% 45%',
  'success-foreground': '0 0% 100%',
  'warning': '38 92% 50%',
  'warning-foreground': '0 0% 100%',
  'background': '0 0% 98%',
  'foreground': '222 47% 11%',
  'card': '0 0% 100%',
  'card-foreground': '222 47% 11%',
  'muted': '210 40% 96%',
  'muted-foreground': '215 16% 47%',
  'border': '214 32% 91%',
  'sidebar-background': '222 47% 10%',
  'sidebar-foreground': '210 40% 92%',
  'sidebar-primary': '221 83% 60%',
  'sidebar-accent': '222 47% 15%',
  'sidebar-border': '222 47% 16%',
};

const DARK_DEFAULTS: Record<string, string> = {
  'primary': '221 83% 60%',
  'primary-foreground': '0 0% 100%',
  'ring': '221 83% 60%',
  'destructive': '0 84% 60%',
  'destructive-foreground': '0 0% 100%',
  'success': '142 71% 45%',
  'success-foreground': '0 0% 100%',
  'warning': '38 92% 50%',
  'warning-foreground': '0 0% 100%',
  'background': '222 47% 7%',
  'foreground': '210 40% 95%',
  'card': '222 47% 10%',
  'card-foreground': '210 40% 95%',
  'muted': '222 47% 14%',
  'muted-foreground': '215 20% 55%',
  'border': '222 47% 18%',
  'sidebar-background': '222 47% 5%',
  'sidebar-foreground': '210 40% 88%',
  'sidebar-primary': '221 83% 60%',
  'sidebar-accent': '222 47% 10%',
  'sidebar-border': '222 47% 12%',
};

// ── HSL ↔ Hex conversion ───────────────────────────────────────────────────────

function hslToHex(hsl: string): string {
  const parts = hsl.trim().split(/\s+/);
  if (parts.length < 3) return '#6366f1';
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ── Token row component ────────────────────────────────────────────────────────

function TokenRow({
  tokenKey,
  label,
  value,
  onChange,
}: {
  tokenKey: string;
  label: string;
  value: string;
  onChange: (key: string, val: string) => void;
}) {
  const hexVal = useMemo(() => { try { return hslToHex(value); } catch { return '#6366f1'; } }, [value]);

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div
          className="h-8 w-8 rounded border border-border cursor-pointer"
          style={{ backgroundColor: `hsl(${value})` }}
        />
        <input
          type="color"
          value={hexVal}
          onChange={(e) => onChange(tokenKey, hexToHsl(e.target.value))}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          title={`Pick color for ${label}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <Label className="text-xs text-muted-foreground mb-0.5 block">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(tokenKey, e.target.value)}
          className="h-7 font-mono text-xs"
          placeholder="H S% L%"
        />
      </div>
    </div>
  );
}

// ── Live preview ───────────────────────────────────────────────────────────────

function LivePreview({ tokens }: { tokens: Record<string, string> }) {
  const style = Object.entries(tokens).reduce<Record<string, string>>(
    (acc, [k, v]) => { acc[`--${k}`] = v; return acc; },
    {}
  ) as React.CSSProperties;

  return (
    <div style={style} className="rounded-xl border overflow-hidden text-sm">
      {/* Sidebar strip */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: 'hsl(var(--sidebar-background))', color: 'hsl(var(--sidebar-foreground))' }}
      >
        <div className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--sidebar-primary))' }} />
        <span className="text-xs font-semibold tracking-wide">iTour Car Rental</span>
      </div>

      {/* Content area */}
      <div
        className="p-4 space-y-3"
        style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
      >
        <p className="text-xs font-semibold">Preview</p>

        {/* Card */}
        <div
          className="rounded-lg p-3 space-y-2"
          style={{ background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', border: '1px solid hsl(var(--border))' }}
        >
          <p className="text-xs font-medium">Booking #BK-2024-001</p>
          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Toyota Camry · 3 days</p>
          <div className="flex gap-2 flex-wrap">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              Confirmed
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))' }}
            >
              Paid
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'hsl(var(--warning) / 0.15)', color: 'hsl(var(--warning))' }}
            >
              Pending
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'hsl(var(--destructive) / 0.15)', color: 'hsl(var(--destructive))' }}
            >
              Cancelled
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            className="text-xs px-3 py-1.5 rounded font-medium"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            Primary
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded font-medium"
            style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
          >
            Secondary
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded font-medium"
            style={{ background: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))' }}
          >
            Delete
          </button>
        </div>

        {/* Input mock */}
        <div
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded"
          style={{ border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
        >
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Search bookings…</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function StylingClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: profile } = useQuery({
    queryKey: ['styling'],
    queryFn: stylingApi.get,
  });

  const [lightTokens, setLightTokens] = useState<Record<string, string>>(LIGHT_DEFAULTS);
  const [darkTokens, setDarkTokens] = useState<Record<string, string>>(DARK_DEFAULTS);
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate local state from fetched profile
  useEffect(() => {
    if (!profile || hydrated) return;
    const merged = { ...LIGHT_DEFAULTS, ...profile.tokens };
    const mergedDark = { ...DARK_DEFAULTS, ...profile.darkTokens };
    setLightTokens(merged);
    setDarkTokens(mergedDark);
    setHydrated(true);
  }, [profile, hydrated]);

  const updateMutation = useMutation({
    mutationFn: () => stylingApi.update({ tokens: lightTokens, darkTokens }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['styling'] });
      toast({ title: 'Theme saved', description: 'Changes will apply on next page refresh.' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  function setToken(key: string, val: string) {
    if (mode === 'light') setLightTokens((t) => ({ ...t, [key]: val }));
    else setDarkTokens((t) => ({ ...t, [key]: val }));
  }

  function resetToDefaults() {
    if (mode === 'light') setLightTokens(LIGHT_DEFAULTS);
    else setDarkTokens(DARK_DEFAULTS);
    toast({ title: 'Reset to defaults' });
  }

  const activeTokens = mode === 'light' ? lightTokens : darkTokens;
  const previewTokens = activeTokens;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Styling & Branding</h1>
          <p className="text-sm text-muted-foreground">Customize your dashboard theme and brand colors</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset defaults
          </Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? 'Saving…' : 'Save theme'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Token editor */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'light' | 'dark')}>
              <TabsList>
                <TabsTrigger value="light" className="gap-1.5">
                  <Sun className="h-3.5 w-3.5" /> Light
                </TabsTrigger>
                <TabsTrigger value="dark" className="gap-1.5">
                  <Moon className="h-3.5 w-3.5" /> Dark
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-xs text-muted-foreground">
              Values are HSL without the wrapper: <code className="bg-muted px-1 rounded">H S% L%</code>
            </span>
          </div>

          {TOKEN_GROUPS.map((group) => (
            <div key={group.label} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{group.label}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.tokens.map(({ key, label }) => (
                  <TokenRow
                    key={key}
                    tokenKey={key}
                    label={label}
                    value={activeTokens[key] ?? ''}
                    onChange={setToken}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Border radius */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Borders & Shape</h3>
            <div className="flex items-center gap-4">
              <Label className="w-32 text-xs text-muted-foreground">Border radius</Label>
              <Input
                className="w-28 h-7 text-sm font-mono"
                value={activeTokens['radius'] ?? '0.5rem'}
                onChange={(e) => setToken('radius', e.target.value)}
                placeholder="0.5rem"
              />
              <div className="flex gap-2">
                {['0rem', '0.25rem', '0.5rem', '0.75rem', '1rem'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setToken('radius', r)}
                    className={cn(
                      'h-8 w-8 border text-xs',
                      (activeTokens['radius'] ?? '0.5rem') === r
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground'
                    )}
                    style={{ borderRadius: r }}
                  >
                    {r.replace('rem', '')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {profile?.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Last saved: {new Date(profile.updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Live preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Live Preview</h3>
            <Badge variant="secondary" className="text-xs">
              {mode === 'light' ? <Sun className="h-3 w-3 mr-1" /> : <Moon className="h-3 w-3 mr-1" />}
              {mode}
            </Badge>
          </div>
          <div className="sticky top-4">
            <LivePreview tokens={previewTokens} />
            <p className="text-xs text-muted-foreground mt-2">
              Preview updates live. Save to apply to the entire app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
