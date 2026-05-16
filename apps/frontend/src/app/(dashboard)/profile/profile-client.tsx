'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Lock, ShieldCheck, Monitor, Laptop, Smartphone, Globe,
  LogOut, Camera, Loader2, Check, Copy, Eye, EyeOff, Bell,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { profileApi } from '@/lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/lib/hooks/use-toast';
import { format, parseISO } from 'date-fns';

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function deviceIcon(ua: string | null) {
  if (!ua) return <Globe className="h-4 w-4" />;
  const lower = ua.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone'))
    return <Smartphone className="h-4 w-4" />;
  return <Laptop className="h-4 w-4" />;
}

// ─── Profile Info tab ─────────────────────────────────────────────────────────

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  language: z.string(),
  themePreference: z.string().nullable().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfileInfoTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: profileApi.me,
  });

  const { register, handleSubmit, control, reset, formState: { errors, isDirty } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', language: 'en', themePreference: null },
  });

  React.useEffect(() => {
    if (profile) {
      reset({
        fullName: profile.fullName,
        language: profile.language,
        themePreference: profile.themePreference,
      });
    }
  }, [profile, reset]);

  const updateMutation = useMutation({
    mutationFn: (dto: ProfileFormValues) => profileApi.update(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      toast({ title: 'Profile updated' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Avatar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatarUrl} />
                <AvatarFallback className="text-lg">{initials(profile.fullName)}</AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-1 -end-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90"
              >
                <Camera className="h-3 w-3" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      await profileApi.uploadAvatar(file);
                      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
                      toast({ title: 'Avatar updated' });
                    } catch {
                      toast({ title: 'Upload failed', variant: 'destructive' });
                    }
                  }}
                />
              </label>
            </div>
            <div>
              <p className="font-semibold">{profile.fullName}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <Badge variant="secondary" className="mt-1">{profile.role.replace('_', ' ')}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => updateMutation.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" {...register('fullName')} />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Controller
                name="language"
                control={control}
                render={({ field }) => (
                  <Combobox
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'ar', label: 'العربية' },
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Theme</Label>
              <Controller
                name="themePreference"
                control={control}
                render={({ field }) => (
                  <Combobox
                    options={[
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                      { value: 'system', label: 'System' },
                    ]}
                    value={field.value ?? 'system'}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </div>
            <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Security tab (change password) ──────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

function SecurityTab() {
  const { toast } = useToast();
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  const changeMutation = useMutation({
    mutationFn: (dto: PasswordFormValues) =>
      profileApi.changePassword(dto.currentPassword, dto.newPassword),
    onSuccess: () => {
      reset();
      toast({ title: 'Password changed successfully' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
          <CardDescription>Use a strong, unique password you don't use elsewhere.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => changeMutation.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  {...register('currentPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  {...register('newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" disabled={changeMutation.isPending}>
              {changeMutation.isPending ? 'Changing…' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 2FA tab ──────────────────────────────────────────────────────────────────

function TwoFATab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [otpCode, setOtpCode] = React.useState('');
  const [disablePassword, setDisablePassword] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const { data: profile } = useQuery({ queryKey: ['profile', 'me'], queryFn: profileApi.me });

  const setupMutation = useMutation({
    mutationFn: profileApi.setup2fa,
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => profileApi.verify2fa(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      setupMutation.reset();
      setOtpCode('');
      toast({ title: '2FA enabled successfully' });
    },
    onError: (e: Error) => toast({ title: 'Invalid code', description: e.message, variant: 'destructive' }),
  });

  const disableMutation = useMutation({
    mutationFn: (password: string) => profileApi.disable2fa(password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      setDisablePassword('');
      toast({ title: '2FA disabled' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  function copySecret() {
    if (setupMutation.data?.secret) {
      navigator.clipboard.writeText(setupMutation.data.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!profile) return null;

  if (profile.twoFactorEnabled) {
    return (
      <div className="max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              Two-Factor Authentication is Enabled
            </CardTitle>
            <CardDescription>
              Your account is protected with TOTP-based 2FA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <div className="space-y-1.5">
              <Label htmlFor="disable-password">Enter your password to disable 2FA</Label>
              <Input
                id="disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Current password"
              />
            </div>
            <Button
              variant="destructive"
              onClick={() => disableMutation.mutate(disablePassword)}
              disabled={!disablePassword || disableMutation.isPending}
            >
              {disableMutation.isPending ? 'Disabling…' : 'Disable 2FA'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enable Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security using an authenticator app (Google Authenticator, Authy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!setupMutation.data ? (
            <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
              {setupMutation.isPending ? 'Setting up…' : 'Set Up 2FA'}
            </Button>
          ) : (
            <>
              <div className="flex flex-col items-start gap-4">
                <div className="rounded-md border p-4 bg-white">
                  <p className="text-xs text-center text-muted-foreground mb-2">
                    Scan this QR code in your authenticator app
                  </p>
                  {setupMutation.data?.qrDataUrl ? (
                    <img src={setupMutation.data.qrDataUrl} alt="2FA QR Code" className="h-32 w-32" />
                  ) : (
                    <div className="h-32 w-32 bg-muted rounded" />
                  )}
                </div>
                <div className="space-y-1.5 w-full">
                  <Label>Manual entry key</Label>
                  <div className="flex items-center gap-2">
                    <Input value={setupMutation.data.secret} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={copySecret} className="shrink-0">
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label htmlFor="otp-code">Enter the 6-digit code from your app</Label>
                <div className="flex gap-2">
                  <Input
                    id="otp-code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="max-w-[140px] text-center font-mono tracking-widest"
                    maxLength={6}
                  />
                  <Button
                    onClick={() => verifyMutation.mutate(otpCode)}
                    disabled={otpCode.length !== 6 || verifyMutation.isPending}
                  >
                    {verifyMutation.isPending ? 'Verifying…' : 'Verify & Enable'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Notification prefs tab ───────────────────────────────────────────────────

const NOTIF_PREFS = [
  { key: 'booking.confirmed', label: 'Booking confirmed' },
  { key: 'booking.cancelled', label: 'Booking cancelled' },
  { key: 'booking.checkin', label: 'Check-in' },
  { key: 'booking.checkout', label: 'Check-out' },
  { key: 'payment.received', label: 'Payment received' },
  { key: 'invoice.generated', label: 'Invoice generated' },
  { key: 'maintenance.due', label: 'Maintenance due' },
  { key: 'system.alerts', label: 'System alerts' },
] as const;

function NotificationPrefsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: profile } = useQuery({ queryKey: ['profile', 'me'], queryFn: profileApi.me });

  const prefs: Record<string, boolean> = (profile?.notificationPrefs as Record<string, boolean>) ?? {};

  const { mutate: save, isPending } = useMutation({
    mutationFn: (notificationPrefs: Record<string, boolean>) =>
      profileApi.update({ notificationPrefs }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', 'me'] });
      toast({ title: 'Preferences saved' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const [local, setLocal] = React.useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = React.useState(false);

  if (profile && !hydrated) {
    setHydrated(true);
    setLocal(Object.fromEntries(NOTIF_PREFS.map(({ key }) => [key, prefs[key] !== false])));
  }

  return (
    <div className="max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">In-app Notifications</CardTitle>
          <CardDescription>Choose which events create an in-app notification for you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {NOTIF_PREFS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <label htmlFor={`notif-${key}`} className="text-sm cursor-pointer">{label}</label>
              <Switch
                id={`notif-${key}`}
                checked={local[key] ?? true}
                onCheckedChange={(v) => setLocal((l) => ({ ...l, [key]: v }))}
              />
            </div>
          ))}
          <Button size="sm" className="mt-2 w-full" onClick={() => save(local)} disabled={isPending || !hydrated}>
            {isPending ? 'Saving…' : 'Save Preferences'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sessions tab ─────────────────────────────────────────────────────────────

function SessionsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['profile', 'sessions'],
    queryFn: profileApi.getSessions,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => profileApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'sessions'] });
      toast({ title: 'Session revoked' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Sessions</CardTitle>
          <CardDescription>
            These are the devices currently logged into your account. Revoke any you don't recognise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !sessions?.length ? (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            <div className="divide-y">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-start justify-between py-3 gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">{deviceIcon(s.userAgent)}</div>
                    <div>
                      <p className="text-sm font-medium">
                        {s.device ?? 'Unknown Device'}
                        {s.isCurrent && (
                          <Badge variant="success" className="ms-2 text-xs">Current</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.ip ?? 'Unknown IP'} · Last active {format(parseISO(s.lastActiveAt), 'PPp')}
                      </p>
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-1 text-muted-foreground hover:text-destructive"
                      onClick={() => revokeMutation.mutate(s.id)}
                      disabled={revokeMutation.isPending}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfileClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account, security, and preferences.</p>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            Password
          </TabsTrigger>
          <TabsTrigger value="2fa" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            2FA
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Monitor className="h-4 w-4" />
            Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6"><ProfileInfoTab /></TabsContent>
        <TabsContent value="security" className="mt-6"><SecurityTab /></TabsContent>
        <TabsContent value="2fa" className="mt-6"><TwoFATab /></TabsContent>
        <TabsContent value="notifications" className="mt-6"><NotificationPrefsTab /></TabsContent>
        <TabsContent value="sessions" className="mt-6"><SessionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
