'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, Eye, EyeOff, ToggleLeft, ToggleRight, Pencil, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';

import {
  webhooksApi, Webhook, CreateWebhookDto,
  apiKeysApi, ApiKey, CreatedApiKey,
  featureFlagsApi, FeatureFlag,
} from '@/lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';

// ─── Webhooks tab ──────────────────────────────────────────────────────────────

const webhookSchema = z.object({
  name: z.string().min(1),
  url: z.string().url('Must be a valid URL'),
  secret: z.string().optional(),
  events: z.string().min(1, 'At least one event required'),
});

type WebhookForm = z.infer<typeof webhookSchema>;

function WebhooksTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Webhook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);

  const { data: webhooks = [] } = useQuery({ queryKey: ['webhooks'], queryFn: () => webhooksApi.list() });

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (dto: CreateWebhookDto) =>
      editTarget ? webhooksApi.update(editTarget.id, dto) : webhooksApi.create(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); setSheetOpen(false); setEditTarget(null); form.reset(); toast({ title: editTarget ? 'Webhook updated' : 'Webhook created' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: toggle } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => webhooksApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const { mutate: del, isPending: deleting } = useMutation({
    mutationFn: () => webhooksApi.delete(deleteTarget!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); setDeleteTarget(null); toast({ title: 'Webhook deleted' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const form = useForm<WebhookForm>({ resolver: zodResolver(webhookSchema) });

  const openEdit = (w: Webhook) => {
    setEditTarget(w);
    form.reset({ name: w.name, url: w.url, secret: w.secret, events: w.events.join(', ') });
    setSheetOpen(true);
  };

  const COMMON_EVENTS = [
    'booking.created', 'booking.confirmed', 'booking.cancelled', 'booking.completed',
    'payment.recorded', 'maintenance.completed', 'accident.reported',
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Receive HTTP POST notifications when events occur.</p>
          <Button size="sm" onClick={() => { setEditTarget(null); form.reset(); setSheetOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Webhook
          </Button>
        </div>

        {webhooks.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">No webhooks configured.</div>
        )}

        <div className="space-y-2">
          {webhooks.map((w) => (
            <div key={w.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{w.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${w.isActive ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                    {w.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">{w.url}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {w.events.map((e) => (
                    <span key={e} className="text-[10px] rounded border border-border px-1.5 py-0.5 font-mono text-muted-foreground">{e}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Switch checked={w.isActive} onCheckedChange={(v) => toggle({ id: w.id, isActive: v })} />
                <Button variant="ghost" size="sm" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(w)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditTarget(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editTarget ? 'Edit Webhook' : 'Add Webhook'}</SheetTitle></SheetHeader>
          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((d) => save({ name: d.name, url: d.url, secret: d.secret, events: d.events.split(',').map((e) => e.trim()).filter(Boolean) }))}>
            <div className="space-y-2"><Label>Name *</Label><Input {...form.register('name')} placeholder="My webhook" />{form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}</div>
            <div className="space-y-2"><Label>URL *</Label><Input {...form.register('url')} placeholder="https://…" className="font-mono text-sm" />{form.formState.errors.url && <p className="text-xs text-destructive">{form.formState.errors.url.message}</p>}</div>
            <div className="space-y-2"><Label>Secret (optional)</Label><Input {...form.register('secret')} placeholder="Signing secret" className="font-mono text-sm" /></div>
            <div className="space-y-2">
              <Label>Events (comma-separated) *</Label>
              <Input {...form.register('events')} placeholder="booking.created, payment.recorded" className="font-mono text-sm" />
              <div className="flex flex-wrap gap-1 mt-1">
                {COMMON_EVENTS.map((e) => (
                  <button key={e} type="button" className="text-[10px] rounded border border-border px-1.5 py-0.5 hover:bg-accent font-mono" onClick={() => {
                    const cur = form.getValues('events');
                    const parts = cur ? cur.split(',').map((s) => s.trim()).filter(Boolean) : [];
                    if (!parts.includes(e)) form.setValue('events', [...parts, e].join(', '));
                  }}>{e}</button>
                ))}
              </div>
              {form.formState.errors.events && <p className="text-xs text-destructive">{form.formState.errors.events.message}</p>}
            </div>
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editTarget ? 'Update' : 'Create'}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Webhook</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Delete <strong>{deleteTarget?.name}</strong>? All delivery history will be removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => del()}>{deleting ? 'Deleting…' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── API Keys tab ──────────────────────────────────────────────────────────────

const apiKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.string(),
});

function ApiKeysTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<CreatedApiKey | null>(null);
  const [visible, setVisible] = useState(false);

  const { data: keys = [] } = useQuery({ queryKey: ['api-keys'], queryFn: () => apiKeysApi.list() });

  const { mutate: create, isPending } = useMutation({
    mutationFn: (dto: { name: string; scopes: string[] }) => apiKeysApi.create(dto),
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: ['api-keys'] }); setNewKey(k as CreatedApiKey); setCreateOpen(false); form.reset(); toast({ title: 'API key created — copy it now, it will not be shown again', variant: 'default' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const { mutate: revoke } = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast({ title: 'Key revoked' }); },
  });

  const form = useForm<z.infer<typeof apiKeySchema>>({ resolver: zodResolver(apiKeySchema), defaultValues: { scopes: 'read' } });

  const copyKey = () => {
    if (newKey?.key) { navigator.clipboard.writeText(newKey.key); toast({ title: 'Copied to clipboard' }); }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">API keys for programmatic access.</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create Key</Button>
        </div>

        {keys.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">No API keys.</div>
        )}

        <div className="space-y-2">
          {keys.map((k: ApiKey) => (
            <div key={k.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{k.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Created {format(parseISO(k.createdAt), 'dd MMM yyyy')}
                  {k.lastUsedAt && ` · Last used ${format(parseISO(k.lastUsedAt), 'dd MMM yyyy')}`}
                </div>
                <div className="mt-1 flex gap-1">
                  {k.scopes.map((s) => (
                    <span key={s} className="text-[10px] rounded border border-border px-1.5 py-0.5 font-mono">{s}</span>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm('Revoke this key?')) revoke(k.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* New key created — show once */}
      {newKey && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
            <CheckCircle className="h-4 w-4" /> New key created — copy it now
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs rounded border border-border bg-background px-3 py-2 overflow-auto">
              {visible ? newKey.key : '•'.repeat(40)}
            </code>
            <Button variant="ghost" size="sm" onClick={() => setVisible((v) => !v)}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
            <Button variant="outline" size="sm" onClick={copyKey}><Copy className="h-4 w-4 mr-1" />Copy</Button>
          </div>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setNewKey(null); setVisible(false); }}>Dismiss</Button>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create API Key</DialogTitle></DialogHeader>
          <form className="space-y-4 py-2" onSubmit={form.handleSubmit((d) => create({ name: d.name, scopes: d.scopes.split(',').map((s) => s.trim()).filter(Boolean) }))}>
            <div className="space-y-2"><Label>Name *</Label><Input {...form.register('name')} placeholder="My integration" /></div>
            <div className="space-y-2"><Label>Scopes (comma-separated)</Label><Input {...form.register('scopes')} placeholder="read, write" className="font-mono text-sm" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Feature flags tab ──────────────────────────────────────────────────────────

const flagSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, 'lowercase, numbers, underscores only'),
  enabled: z.boolean(),
  rolloutPct: z.coerce.number().min(0).max(100),
});

function FeatureFlagsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: flags = [] } = useQuery({ queryKey: ['feature-flags'], queryFn: () => featureFlagsApi.list() });

  const { mutate: upsert } = useMutation({
    mutationFn: ({ key, dto }: { key: string; dto: { enabled: boolean; rolloutPct?: number } }) =>
      featureFlagsApi.upsert(key, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feature-flags'] }),
  });

  const { mutate: del } = useMutation({
    mutationFn: (key: string) => featureFlagsApi.delete(key),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feature-flags'] }); toast({ title: 'Flag deleted' }); },
  });

  const { mutate: create, isPending } = useMutation({
    mutationFn: (d: z.infer<typeof flagSchema>) => featureFlagsApi.upsert(d.key, { enabled: d.enabled, rolloutPct: d.rolloutPct }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feature-flags'] }); setCreateOpen(false); form.reset(); toast({ title: 'Flag created' }); },
  });

  const form = useForm<z.infer<typeof flagSchema>>({ resolver: zodResolver(flagSchema), defaultValues: { enabled: false, rolloutPct: 100 } });

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Toggle features on/off with optional rollout percentage.</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Flag</Button>
        </div>

        {flags.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">No feature flags.</div>
        )}

        <div className="space-y-2">
          {flags.map((f: FeatureFlag) => (
            <div key={f.key} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-medium">{f.key}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {f.rolloutPct < 100 ? `${f.rolloutPct}% rollout` : 'Full rollout'}
                  {f.roles.length > 0 && ` · ${f.roles.join(', ')}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => upsert({ key: f.key, dto: { enabled: !f.enabled } })} className="text-muted-foreground hover:text-foreground transition-colors">
                  {f.enabled
                    ? <ToggleRight className="h-6 w-6 text-primary" />
                    : <ToggleLeft className="h-6 w-6" />}
                </button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm(`Delete flag "${f.key}"?`)) del(f.key); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Feature Flag</DialogTitle></DialogHeader>
          <form className="space-y-4 py-2" onSubmit={form.handleSubmit((d) => create(d))}>
            <div className="space-y-2"><Label>Key *</Label><Input {...form.register('key')} placeholder="my_feature" className="font-mono" />{form.formState.errors.key && <p className="text-xs text-destructive">{form.formState.errors.key.message}</p>}</div>
            <div className="space-y-2"><Label>Rollout %</Label><Input {...form.register('rolloutPct')} type="number" min={0} max={100} /></div>
            <div className="flex items-center gap-3">
              <Switch {...form.register('enabled')} onCheckedChange={(v) => form.setValue('enabled', v)} />
              <Label>Enabled from creation</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function SettingsClient() {
  return (
    <Tabs defaultValue="webhooks" className="space-y-6">
      <TabsList>
        <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        <TabsTrigger value="feature-flags">Feature Flags</TabsTrigger>
      </TabsList>

      <TabsContent value="webhooks" className="space-y-4">
        <WebhooksTab />
      </TabsContent>

      <TabsContent value="api-keys" className="space-y-4">
        <ApiKeysTab />
      </TabsContent>

      <TabsContent value="feature-flags" className="space-y-4">
        <FeatureFlagsTab />
      </TabsContent>
    </Tabs>
  );
}
