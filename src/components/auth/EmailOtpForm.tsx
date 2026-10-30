'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { sendOtpAction, verifyOtpAction, type OtpMode } from '@/app/(auth)/otp-actions';
import { TextField, type FieldTone } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';

// Mã 6 số qua email (SPEC-identity.md bổ sung 29/10): bước 1 nhập email (không hỏi tên) → gửi mã; bước 2 nhập
// mã → vào luôn. mode "link": gửi mã về email trong vé liên kết Google/Facebook (người dùng không tự nhập email).
// mode "add-email": thêm email cho tài khoản chưa có (mở Kiot).
export function EmailOtpForm({
  mode = 'login',
  next = '/',
  tone = 'dark',
  linkEmail,
  commit = false,
}: {
  mode?: OtpMode;
  next?: string;
  tone?: Exclude<FieldTone, 'light'>;
  linkEmail?: string;
  // Trang đăng ký: phải tick "Tôi đồng ý Cam kết nội dung 9MUA" mới gửi mã (SPEC-identity.md V5.6).
  commit?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [pending, start] = useTransition();
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const send = () =>
    start(async () => {
      setError(null);
      const r = await sendOtpAction(mode, email);
      if (!r.ok) return setError(r.message);
      setSentTo(r.email);
      setStep('code');
      setCode('');
      setWait(60);
    });

  const verify = () =>
    start(async () => {
      setError(null);
      const r = await verifyOtpAction(mode, {
        email: sentTo,
        code,
        next,
        commit: commit && agreed,
      });
      if (r && !r.ok) return setError(r.message);
      if (mode === 'add-email') {
        setStep('done');
        router.refresh();
      }
    });

  const button =
    'h-11 rounded-full bg-brand text-[14px] font-black text-white shadow-[0_0_18px_rgb(255_107_0/0.35)] disabled:opacity-60';
  const sub = tone === 'sheet' ? 'text-zinc-600' : 'text-white/70';

  if (step === 'done')
    return (
      <p className={`text-[13px] font-bold ${sub}`} role="status" data-testid="otp-done">
        {t('auth.addEmail.done')}
      </p>
    );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 'email') send();
        else verify();
      }}
      noValidate
    >
      {error ? (
        <p role="alert" className="text-[13px] font-bold text-red-400" data-testid="otp-error">
          {error}
        </p>
      ) : null}
      {step === 'email' ? (
        <>
          {mode === 'link' ? (
            <p className={`text-[13px] ${sub}`}>{linkEmail}</p>
          ) : (
            <TextField
              tone={tone}
              label={t('auth.otp.email')}
              name="otpEmail"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="otp-email"
            />
          )}
          {commit ? (
            <label className={`flex items-start gap-2 text-[13px] ${sub}`}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#ff6b00]"
                data-testid="otp-commit"
              />
              <span>
                {t('common.commit.signup')} ·{' '}
                <a href="/cam-ket" target="_blank" rel="noopener" className="font-bold text-brand underline">
                  {t('common.commit.view')}
                </a>
              </span>
            </label>
          ) : null}
          <button
            type="submit"
            disabled={pending || (commit && !agreed)}
            className={button}
            data-testid="otp-send"
          >
            {pending ? t('auth.otp.sending') : mode === 'link' ? t('auth.otp.linkSend') : t('auth.otp.send')}
          </button>
        </>
      ) : (
        <>
          <p className={`text-[13px] ${sub}`} data-testid="otp-sent">
            {t('auth.otp.sent', { email: sentTo })}
          </p>
          <TextField
            tone={tone}
            label={t('auth.otp.code')}
            name="otpCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            data-testid="otp-code"
          />
          <button
            type="submit"
            disabled={pending || code.length !== 6}
            className={button}
            data-testid="otp-verify"
          >
            {pending ? t('auth.otp.verifying') : t('auth.otp.verify')}
          </button>
          <div className={`flex justify-between text-[12px] font-bold ${sub}`}>
            <button
              type="button"
              disabled={wait > 0 || pending}
              onClick={send}
              className="disabled:opacity-60"
            >
              {wait > 0 ? t('auth.otp.resendIn', { seconds: wait }) : t('auth.otp.resend')}
            </button>
            {mode === 'link' ? null : (
              <button type="button" onClick={() => setStep('email')}>
                {t('auth.otp.change')}
              </button>
            )}
          </div>
        </>
      )}
    </form>
  );
}
