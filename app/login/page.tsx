/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryState, parseAsString } from 'nuqs';
import Link from 'next/link';
import {
  Phone,
  Loader2,
  Bot,
  MessageSquareText,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { verifyOtpAction } from '@/app/actions/auth';

// --- COMPONENT: OTP PIN INPUT ---
const OtpInput = ({
  length = 5,
  onComplete,
  disabled,
}: {
  length?: number;
  onComplete: (code: string) => void;
  disabled: boolean;
}) => {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    // Allow only last character if multiple typed in one box (mobile fix)
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto focus next
    if (value && index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check completion
    const combinedCode = newOtp.join('');
    if (combinedCode.length === length && newOtp.every((val) => val !== '')) {
      onComplete(combinedCode);
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    // Backspace logic: Move to previous input
    if (
      e.key === 'Backspace' &&
      !otp[index] &&
      index > 0 &&
      inputRefs.current[index - 1]
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);
    if (!/^\d+$/.test(pastedData)) return; // Only numbers

    const newOtp = pastedData.split('');
    // Fill remaining with empty if paste is short
    while (newOtp.length < length) newOtp.push('');

    setOtp(newOtp);

    // Focus last filled or last input
    const focusIndex = Math.min(pastedData.length, length - 1);
    inputRefs.current[focusIndex]?.focus();

    if (pastedData.length === length) {
      onComplete(pastedData);
    }
  };

  return (
    <div className='flex gap-2 justify-center direction-ltr' dir="ltr">
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(ref) => {
            inputRefs.current[index] = ref;
          }}
          type='text'
          inputMode='numeric'
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all outline-none 
            ${digit
              ? 'border-amber-500 bg-amber-50 text-amber-900'
              : 'border-gray-200 bg-gray-50 focus:border-amber-400 focus:bg-white'
            } disabled:opacity-50`}
        />
      ))}
    </div>
  );
};

// --- MAIN FORM CONTENT ---
function LoginFormContent() {
  const router = useRouter();

  // --- NUQS STATE ---
  const [step, setStep] = useQueryState(
    'step',
    parseAsString.withDefault('phone')
  );
  const [phoneParam, setPhoneParam] = useQueryState(
    'phone',
    parseAsString.withDefault('')
  );
  const [methodParam, setMethodParam] = useQueryState(
    'method',
    parseAsString.withDefault('telegram')
  );

  // --- LOCAL STATE ---
  const [inputPhone, setInputPhone] = useState(phoneParam);
  const [localMethod, setLocalMethod] = useState<'telegram' | 'sms'>('telegram');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBotHelp, setShowBotHelp] = useState(false);

  // Sync local phone with URL param only on mount
  useEffect(() => {
    if (phoneParam) setInputPhone(phoneParam);
  }, []);

  // --- ACTION: REQUEST OTP ---
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setShowBotHelp(false);

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: inputPhone,
          method: localMethod,
        }),
      });
      const data = await res.json();

      if (res.status === 404) {
        setError(data.message);
        if (localMethod === 'telegram') setShowBotHelp(true);
        return;
      }

      if (!res.ok) throw new Error(data.error);

      // Successfully sent OTP
      await setPhoneParam(data.identifier); // Cleaned number
      await setMethodParam(localMethod);
      await setStep('verify');
    } catch (err: any) {
      setError(err.message || 'خطا در برقراری ارتباط');
    } finally {
      setLoading(false);
    }
  };

  // --- ACTION: VERIFY OTP ---
  const handleVerifyOtp = async (code: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await verifyOtpAction(phoneParam, code);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.success) {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'کد نادرست است');
      setLoading(false); // Stop loading only on error, otherwise keep spinning while redirecting
    }
  };

  // --- ACTION: BACK ---
  const goBack = async () => {
    // Clear the step param to force the UI back to phone view
    await setStep(null);
    setError('');
    // We do NOT clear inputPhone so user can edit it easily
  };

  return (
    <div className='w-full max-w-md bg-white/40  md:bg-white dark:bg-gray-900 rounded-3xl shadow-2xl shadow-gray-200/50 dark:shadow-black/50 p-8 border border-white/20 relative overflow-hidden'>


      {/* Top Gradient Line */}

      {/* --- BRANDING HEADER --- */}
      <div className="flex justify-center mb-8">
      </div>

      {/* --- FORM HEADER --- */}
      <div className='text-center mb-8 relative px-2'>
        {step === 'verify' && (
          <button
            onClick={goBack}
            className='absolute right-0 top-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 transition-colors'
            title="بازگشت"
          >
            <ArrowRight className='w-5 h-5' />
          </button>
        )}
        <h1 className='text-xl font-bold text-gray-800 dark:text-white mb-2'>
          {step === 'phone' ? 'ورود به حساب کاربری' : 'تایید شماره موبایل'}
        </h1>
        <p className='text-xs text-gray-500 dark:text-gray-400 leading-relaxed'>
          {step === 'phone'
            ? 'برای استفاده از خدمات، شماره موبایل خود را وارد کنید'
            : `کد ۵ رقمی ارسال شده به ${phoneParam} را وارد کنید`}
        </p>
      </div>

      {/* --- GLOBAL ERROR --- */}
      {error && (
        <div className='mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-300 text-xs rounded-xl text-center animate-pulse-short'>
          <p className="font-bold mb-1">خطا</p>
          <p>{error}</p>
          {showBotHelp && (
            <div className='mt-3 pt-3 border-t border-red-200 dark:border-red-800'>
              <a
                href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`}
                target='_blank'
                rel='noreferrer'
                className='block w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-colors'
              >
                <Bot className='w-4 h-4' />
                <span>شروع ربات تلگرام</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* --- STEP 1: PHONE INPUT --- */}
      {step === 'phone' ? (
        <form
          onSubmit={handleRequestOtp}
          className='space-y-5 animate-in fade-in slide-in-from-right-4 duration-300'
        >
          {/* Method Selection */}
          <div className='grid grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl'>
            <button
              type='button'
              onClick={() => setLocalMethod('telegram')}
              className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${localMethod === 'telegram'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
            >
              <Bot className='w-4 h-4' />
              تلگرام (سریع)
            </button>
            <button
              type='button'
              onClick={() => setLocalMethod('sms')}
              className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${localMethod === 'sms'
                  ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-500 shadow-sm ring-1 ring-black/5'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
            >
              <MessageSquareText className='w-4 h-4' />
              پیامک
            </button>
          </div>

          <div>
            <div className='relative group'>
              <input
                type='tel'
                required
                value={inputPhone}
                onChange={(e) => setInputPhone(e.target.value)}
                placeholder='0912...'
                className='w-full pl-4 pr-12 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-left ltr font-mono text-lg text-gray-800 dark:text-gray-200 placeholder:text-gray-400'
                dir='ltr'
              />
              <div className='absolute right-0 top-0 h-full w-12 flex items-center justify-center text-gray-400 group-focus-within:text-amber-500 transition-colors'>
                <Phone className='w-5 h-5' />
              </div>
            </div>
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full bg-amber-500 hover:bg-amber-600  text-white dark:text-gray-900 font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]'
          >
            {loading ? (
              <Loader2 className='w-5 h-5 animate-spin' />
            ) : (
              <span>دریافت کد تایید</span>
            )}
          </button>
        </form>
      ) : (
        /* --- STEP 2: PIN INPUT --- */
        <div className='space-y-8 animate-in fade-in slide-in-from-right-4 duration-300'>

          {/* Pin Input Component */}
          <div className="py-2">
            <OtpInput
              length={5}
              onComplete={handleVerifyOtp}
              disabled={loading}
            />
          </div>

          <div className="text-center">
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-amber-600 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>در حال اعتبارسنجی...</span>
              </div>
            ) : (
              <button
                onClick={goBack}
                className='text-xs text-gray-400 hover:text-amber-600 transition-colors border-b border-dashed border-gray-300 hover:border-amber-600 pb-0.5'
              >
                شماره اشتباه است؟ اصلاح شماره
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- FOOTER: POLICY --- */}
      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
        <p className="text-[10px] text-gray-400 flex flex-wrap items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          <span>ورود شما به معنای پذیرش</span>
          <Link href="/policy" className="text-gray-600 dark:text-gray-300 hover:text-amber-600 underline decoration-gray-300 dark:decoration-gray-700 underline-offset-2 transition-colors">
            قوانین و حریم خصوصی
          </Link>
          <span>است.</span>
        </p>
      </div>

    </div>
  );
}

// Wrapper for Suspense boundary (Required by nuqs)
export default function LoginPage() {
  return (
    <div
      className='min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 '
      dir='rtl'
    >
      <span className='mb-8' >Logo</span>
      {/* <Logo className='w-[80dvw] md:w-[30dvw] opacity-5 absolute translate-x-1/5 bottom-0 right-0 -rotate-12' /> */}
      <Suspense
        fallback={<Loader2 className='w-8 h-8 animate-spin text-amber-500' />}
      >
        <LoginFormContent />
      </Suspense>
    </div>
  );
}

