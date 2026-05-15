'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, User2, Plus, Trash2, RefreshCw } from 'lucide-react';
import { permissionsApi, usersApi, lookupApi, PermissionOverride } from '@/lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AsyncCombobox } from '@/components/ui/combobox/async-combobox';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/lib/hooks/use-toast';

// ─── Permission key groups for the matrix ────────────────────────────────────

const PERMISSION_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: 'Dashboard & Calendar', keys: ['dashboard.view', 'calendar.view'] },
  { label: 'Fleet', keys: ['cars.view', 'cars.create', 'cars.edit', 'cars.delete', 'cars.export', 'cars.transfer'] },
  { label: 'Bookings', keys: ['bookings.view', 'bookings.create', 'bookings.edit', 'bookings.delete', 'bookings.export', 'bookings.cancel', 'bookings.refund', 'bookings.view.cost_breakdown'] },
  { label: 'Customers', keys: ['customers.view', 'customers.create', 'customers.edit', 'customers.delete', 'customers.export'] },
  { label: 'Corporate Accounts', keys: ['corporate_accounts.view', 'corporate_accounts.create', 'corporate_accounts.edit', 'corporate_accounts.delete'] },
  { label: 'Payments', keys: ['payments.view', 'payments.create', 'payments.edit', 'payments.delete', 'payments.export'] },
  { label: 'Invoices', keys: ['invoices.view', 'invoices.create', 'invoices.edit', 'invoices.delete', 'invoices.export'] },
  { label: 'Damage & Fines', keys: ['damage_fines.view', 'damage_fines.create', 'damage_fines.edit', 'damage_fines.delete'] },
  { label: 'Maintenance', keys: ['maintenance.view', 'maintenance.create', 'maintenance.edit', 'maintenance.delete', 'maintenance.vendors.view', 'maintenance.vendors.create', 'maintenance.vendors.edit'] },
  { label: 'Parts', keys: ['parts.view', 'parts.create', 'parts.edit', 'parts.delete'] },
  { label: 'Accidents', keys: ['accidents.view', 'accidents.create', 'accidents.edit', 'accidents.delete'] },
  { label: 'Insurance', keys: ['insurance.view', 'insurance.create', 'insurance.edit', 'insurance.delete'] },
  { label: 'Branches', keys: ['branches.view', 'branches.create', 'branches.edit', 'branches.delete'] },
  { label: 'Staff / Users', keys: ['users.view', 'users.create', 'users.edit', 'users.delete', 'users.impersonate'] },
  { label: 'Reports', keys: ['reports.view', 'reports.export'] },
  { label: 'Audit Log', keys: ['audit_log.view'] },
  { label: 'System', keys: ['system.permissions.view', 'system.permissions.edit', 'system.styling.view', 'system.styling.edit', 'system.settings.view', 'system.settings.edit'] },
];

const ROLES = [
  { id: 'BRANCH_MANAGER', label: 'Branch Manager' },
  { id: 'STAFF', label: 'Staff / Agent' },
  { id: 'ACCOUNTANT', label: 'Accountant' },
  { id: 'MECHANIC', label: 'Mechanic' },
];

function formatKey(key: string) {
  return key.split('.').slice(1).join(' › ').replace(/_/g, ' ');
}

// ─── Role Matrix tab ─────────────────────────────────────────────────────────

function RoleMatrixTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allRoles, isLoading } = useQuery({
    queryKey: ['permissions', 'roles'],
    queryFn: () => permissionsApi.getAllRoles(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ role, key, effect }: { role: string; key: string; effect: 'grant' | 'revoke' }) =>
      permissionsApi.updateRole(role, key, effect),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'roles'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  function getGranted(roleId: string, key: string): boolean {
    if (!allRoles) return false;
    const role = allRoles.find((r) => r.role === roleId);
    return role?.permissions?.[key] ?? false;
  }

  function toggle(roleId: string, key: string, currentValue: boolean) {
    updateMutation.mutate({ role: roleId, key, effect: currentValue ? 'revoke' : 'grant' });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <RefreshCw className="me-2 h-4 w-4 animate-spin" />
        Loading permissions…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-4">
        Super Admin always has full access and cannot be modified here. Toggle permissions for other roles.
      </p>
      {PERMISSION_GROUPS.map((group) => (
        <Card key={group.label} className="overflow-hidden">
          <CardHeader className="py-3 px-4 bg-muted/30">
            <CardTitle className="text-sm font-semibold">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-4 text-start font-medium text-muted-foreground w-48">Permission</th>
                    {ROLES.map((role) => (
                      <th key={role.id} className="py-2 px-4 text-center font-medium text-muted-foreground min-w-[120px]">
                        {role.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.keys.map((key, i) => (
                    <tr key={key} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                      <td className="py-2 px-4 text-muted-foreground capitalize">
                        {formatKey(key)}
                      </td>
                      {ROLES.map((role) => {
                        const granted = getGranted(role.id, key);
                        return (
                          <td key={role.id} className="py-2 px-4 text-center">
                            <Switch
                              checked={granted}
                              onCheckedChange={() => toggle(role.id, key, granted)}
                              disabled={updateMutation.isPending}
                              aria-label={`${role.label}: ${key}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── User Overrides tab ───────────────────────────────────────────────────────

const PERMISSION_OPTIONS = PERMISSION_GROUPS.flatMap((g) =>
  g.keys.map((k) => ({ value: k, label: `${g.label} — ${formatKey(k)}`, description: k })),
);

function UserOverridesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = React.useState('');
  const [selectedUserLabel, setSelectedUserLabel] = React.useState('');
  const [addKey, setAddKey] = React.useState('');
  const [addEffect, setAddEffect] = React.useState<'grant' | 'revoke'>('grant');

  const fetchUsers = React.useCallback(async (q: string) => {
    const results = await lookupApi.users(q);
    return results.map((u) => ({ value: u.id, label: u.fullName, description: u.email ?? undefined }));
  }, []);

  const { data: overrides, isLoading } = useQuery({
    queryKey: ['permissions', 'user-overrides', selectedUserId],
    queryFn: () => permissionsApi.getUserOverrides(selectedUserId),
    enabled: !!selectedUserId,
  });

  const { data: effective } = useQuery({
    queryKey: ['permissions', 'user-effective', selectedUserId],
    queryFn: () => permissionsApi.getUserEffective(selectedUserId),
    enabled: !!selectedUserId,
  });

  const addMutation = useMutation({
    mutationFn: ({ key, effect }: { key: string; effect: 'grant' | 'revoke' }) =>
      permissionsApi.setUserOverride(selectedUserId, key, effect),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'user-overrides', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['permissions', 'user-effective', selectedUserId] });
      setAddKey('');
      toast({ title: 'Override added' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => permissionsApi.deleteUserOverride(selectedUserId, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'user-overrides', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['permissions', 'user-effective', selectedUserId] });
      toast({ title: 'Override removed' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select User</CardTitle>
          <CardDescription>Pick a user to view and manage their permission overrides.</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncCombobox
            fetchOptions={fetchUsers}
            value={selectedUserId}
            displayValue={selectedUserLabel}
            onValueChange={(val, label) => { setSelectedUserId(val); setSelectedUserLabel(label); }}
            placeholder="Search users…"
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {selectedUserId && (
        <>
          {/* Current overrides */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Overrides</CardTitle>
              <CardDescription>
                These override the role defaults for <strong>{selectedUserLabel}</strong>.
                Role: <Badge variant="secondary">{effective?.role ?? '…'}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : !overrides?.length ? (
                <p className="text-sm text-muted-foreground">No overrides — this user uses their role defaults.</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {overrides.map((o: PermissionOverride) => (
                    <div key={o.key} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Badge variant={o.effect === 'grant' ? 'success' : 'destructive'}>
                          {o.effect}
                        </Badge>
                        <span className="text-sm font-mono">{o.key}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(o.key)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add new override */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Override</CardTitle>
              <CardDescription>Grant or revoke a specific permission for this user.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">Permission</label>
                  <Combobox
                    options={PERMISSION_OPTIONS}
                    value={addKey}
                    onValueChange={setAddKey}
                    placeholder="Select permission…"
                    searchPlaceholder="Search permissions…"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Effect</label>
                  <Combobox
                    options={[
                      { value: 'grant', label: 'Grant', description: 'Allow this permission' },
                      { value: 'revoke', label: 'Revoke', description: 'Deny this permission' },
                    ]}
                    value={addEffect}
                    onValueChange={(v) => setAddEffect(v as 'grant' | 'revoke')}
                    className="w-36"
                  />
                </div>
                <Button
                  onClick={() => addMutation.mutate({ key: addKey, effect: addEffect })}
                  disabled={!addKey || addMutation.isPending}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PermissionsClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure role defaults and per-user overrides. All changes are audit-logged.
        </p>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            Role Defaults
          </TabsTrigger>
          <TabsTrigger value="overrides" className="gap-2">
            <User2 className="h-4 w-4" />
            User Overrides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-6">
          <RoleMatrixTab />
        </TabsContent>

        <TabsContent value="overrides" className="mt-6">
          <UserOverridesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
