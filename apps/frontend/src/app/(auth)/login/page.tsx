'use client';

import { useState, useTransition } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Car, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Validation ─────────────────────────────────────────────────────── */

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const totpSchema = z.object({
  totpCode: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator'),
});

type LoginValues = z.infer<typeof loginSchema>;
type TotpValues = z.infer<typeof totpSchema>;

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/* ── Component ─────────────────────────────────────────────────────── */

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard';

  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [challengeToken, setChallengeToken] = useState<string>('');
  const [storedEmail, setStoredEmail] = useState('');

  const {
    register: regLogin,
    handleSubmit: submitLogin,
    formState: { errors: loginErrors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const {
    register: regTotp,
    handleSubmit: submitTotp,
    formState: { errors: totpErrors },
    watch: watchTotp,
  } = useForm<TotpValues>({ resolver: zodResolver(totpSchema) });

  const totpValue = watchTotp('totpCode') ?? '';

  /* ── Step 1: credentials → backend directly from browser ── */
  function onLoginSubmit(values: LoginValues) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          credentials: 'include', // browser receives the sid httpOnly cookie
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: values.email, password: values.password }),
        });

        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error?.message ?? 'Account is locked. Try again later.');
          return;
        }

        if (!res.ok) {
          setError('Invalid email or password.');
          return;
        }

        const body = await res.json();

        // 2FA required
        if (body.requires2fa) {
          setChallengeToken(body.challengeToken ?? '');
          setStoredEmail(values.email);
          setStep('2fa');
          return;
        }

        // Success — store user in Auth.js JWT (for middleware / useSession)
        const result = await signIn('credentials', {
          _user: JSON.stringify(body),
          redirect: false,
        });

        if (result?.error) {
          setError('Sign-in failed. Please try again.');
          return;
        }

        router.push(callbackUrl);
        router.refresh();
      } catch {
        setError('Unable to reach the server. Make sure the backend is running.');
      }
    });
  }

  /* ── Step 2: 2FA verify ── */
  function onTotpSubmit(values: TotpValues) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`${API}/auth/verify-2fa`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeToken, totpCode: values.totpCode }),
        });

        if (!res.ok) {
          setError('Invalid or expired code. Try again.');
          return;
        }

        const body = await res.json();

        const result = await signIn('credentials', {
          _user: JSON.stringify(body),
          redirect: false,
        });

        if (result?.error) {
          setError('Sign-in failed. Please try again.');
          return;
        }

        router.push(callbackUrl);
        router.refresh();
      } catch {
        setError('Unable to reach the server.');
      }
    });
  }

  /* ── Render ── */
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">

      {/* Abstract glow background */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ filter: 'blur(80px)' }}>
        <div className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-blue-700/30" />
        <div className="absolute top-1/3 right-0 h-[380px] w-[380px] rounded-full bg-indigo-600/25" />
        <div className="absolute bottom-0 left-1/3 h-[340px] w-[340px] rounded-full bg-violet-800/20" />
        <div className="absolute top-1/2 left-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/15" />
      </div>

      {/* Noise texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* Glass card */}
      <div className={cn(
        'relative z-10 w-full max-w-sm mx-4',
        'rounded-2xl border border-white/10',
        'bg-white/5 backdrop-blur-xl',
        'shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
        'p-8',
      )}>

        {/* Logo + heading */}
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/90 shadow-lg shadow-blue-500/30">
            <Car className="h-5 w-5 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              {step === '2fa' ? 'Two-factor auth' : 'Welcome back'}
            </h1>
            <p className="mt-0.5 text-sm text-white/50">
              {step === '2fa'
                ? 'Enter the 6-digit code from your authenticator'
                : 'Sign in to iTour Car Rental'}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        {/* ── Credentials form ── */}
        {step === 'credentials' && (
          <form onSubmit={submitLogin(onLoginSubmit)} noValidate className="space-y-4">

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider">
                Email
              </label>
              <input
                {...regLogin('email')}
                type="email"
                autoComplete="email"
                placeholder="mggouda@gmail.com"
                className={cn(
                  'w-full rounded-lg px-3.5 py-2.5 text-sm bg-white/8 border text-white placeholder-white/25',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent transition-all',
                  loginErrors.email ? 'border-red-500/60 bg-red-500/5' : 'border-white/10 hover:border-white/20',
                )}
              />
              {loginErrors.email && <p className="text-xs text-red-400">{loginErrors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  {...regLogin('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={cn(
                    'w-full rounded-lg px-3.5 py-2.5 pr-10 text-sm bg-white/8 border text-white placeholder-white/25',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent transition-all',
                    loginErrors.password ? 'border-red-500/60 bg-red-500/5' : 'border-white/10 hover:border-white/20',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {loginErrors.password && <p className="text-xs text-red-400">{loginErrors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className={cn(
                'mt-1 w-full rounded-lg py-2.5 text-sm font-semibold',
                'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white',
                'shadow-lg shadow-blue-600/25 transition-all duration-150',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black',
                'disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2',
              )}
            >
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : 'Sign in'}
            </button>
          </form>
        )}

        {/* ── 2FA form ── */}
        {step === '2fa' && (
          <form onSubmit={submitTotp(onTotpSubmit)} noValidate className="space-y-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 ring-1 ring-indigo-500/30">
                <ShieldCheck className="h-5 w-5 text-indigo-300" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider text-center">
                Authentication code
              </label>
              <input
                {...regTotp('totpCode')}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="000000"
                maxLength={6}
                className={cn(
                  'w-full rounded-lg px-3.5 py-3 text-center text-2xl font-mono tracking-[0.5em]',
                  'bg-white/8 border text-white placeholder-white/20',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-transparent transition-all',
                  totpErrors.totpCode ? 'border-red-500/60 bg-red-500/5' : 'border-white/10 hover:border-white/20',
                )}
              />
              {totpErrors.totpCode && <p className="text-xs text-red-400 text-center">{totpErrors.totpCode.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isPending || totpValue.length !== 6}
              className={cn(
                'w-full rounded-lg py-2.5 text-sm font-semibold',
                'bg-indigo-600 hover:bg-indigo-500 text-white',
                'shadow-lg shadow-indigo-600/25 transition-all duration-150',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-black',
                'disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2',
              )}
            >
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : 'Verify'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('credentials'); setError(null); }}
              className="w-full text-center text-xs text-white/40 hover:text-white/60 transition-colors py-1"
            >
              ← Back to login
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[11px] text-white/20">
          iTour Car Rental · Admin Dashboard
        </p>
      </div>
    </div>
  );
}
