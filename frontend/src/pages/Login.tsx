import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Logo } from '../components/Brand';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showVerifyLink, setShowVerifyLink] = useState(false);
  
  // Reset password states
  const [isReset, setIsReset] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Verify email states
  const [isVerify, setIsVerify] = useState(false);
  const [verifyStep, setVerifyStep] = useState(1);
  
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const res = await axios.post('/api/auth/token', params);
      localStorage.setItem('token', res.data.access_token);
      navigate('/dashboard');
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Invalid credentials';
      setError(detail);
      if (detail.toLowerCase().includes('verify')) {
        setShowVerifyLink(true);
      } else {
        setShowVerifyLink(false);
      }
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/auth/resend-otp', {
        email, purpose: 'reset'
      });
      setResetStep(2);
      setError('');
      setMsg('If the email is registered, an OTP has been sent.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to request reset');
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      await axios.post('/api/auth/reset-password', {
        email, otp, new_password: newPassword
      });
      setIsReset(false);
      setResetStep(1);
      setOtp('');
      setNewPassword('');
      setPassword('');
      setError('');
      setMsg('Password reset successful. Please login.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password');
    }
  };

  const handleSendVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/auth/resend-otp', {
        email, purpose: 'verification'
      });
      setVerifyStep(2);
      setError('');
      setMsg('If the email is registered, a verification code has been sent.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send verification code');
    }
  };

  const handleConfirmVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/auth/verify-otp', {
        email, otp, purpose: 'verification'
      });
      setIsVerify(false);
      setVerifyStep(1);
      setOtp('');
      setPassword('');
      setError('');
      setMsg('Email verified successfully. Please login.');
      setShowVerifyLink(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to verify email');
    }
  };

  const switchMode = (mode: 'login' | 'reset' | 'verify') => {
    setError('');
    setMsg('');
    setShowVerifyLink(false);
    if (mode === 'login') {
      setIsReset(false);
      setIsVerify(false);
    } else if (mode === 'reset') {
      setIsReset(true);
      setIsVerify(false);
      setResetStep(1);
    } else if (mode === 'verify') {
      setIsVerify(true);
      setIsReset(false);
      setVerifyStep(1);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col items-center">
          <Logo withTagline />
          <h2 className="mt-8 text-center text-2xl font-bold text-gray-900">
            {isReset ? 'Reset Password' : isVerify ? 'Verify Email' : 'Sign in to your account'}
          </h2>
        </div>
        
        {!isReset && !isVerify ? (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}
            {msg && <div className="text-green-600 text-sm text-center bg-green-50 p-2 rounded">{msg}</div>}
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input type="email" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <button type="button" onClick={() => switchMode('reset')} className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
                  Forgot your password?
                </button>
              </div>
            </div>

            <div>
              <button type="submit" className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-colors">
                Sign in
              </button>
            </div>
            
            {showVerifyLink && (
              <div className="text-center text-sm mt-4">
                <button type="button" onClick={() => switchMode('verify')} className="font-medium text-orange-600 hover:text-orange-500">
                  Click here to verify your account
                </button>
              </div>
            )}
            
            <div className="text-center text-sm border-t border-gray-100 pt-6">
              Don't have an account? <Link to="/register" className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">Register</Link>
            </div>
          </form>
        ) : isReset ? (
          resetStep === 1 ? (
            <form className="mt-8 space-y-6" onSubmit={handleSendReset}>
              {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}
              <div className="rounded-md shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                  <input type="email" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <button type="submit" className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-colors">
                  Send Reset Code
                </button>
              </div>
              <div className="text-center text-sm">
                <button type="button" onClick={() => switchMode('login')} className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
                  Back to login
                </button>
              </div>
            </form>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleConfirmReset}>
              {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}
              {msg && <div className="text-green-600 text-sm text-center bg-green-50 p-2 rounded">{msg}</div>}
              <div className="rounded-md shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                  <input type="text" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" placeholder="123456" value={otp} onChange={e => setOtp(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input type="password" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
              </div>
              <div>
                <button type="submit" className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-colors">
                  Confirm Reset
                </button>
              </div>
            </form>
          )
        ) : (
          verifyStep === 1 ? (
            <form className="mt-8 space-y-6" onSubmit={handleSendVerify}>
              {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}
              <div className="rounded-md shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                  <input type="email" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <button type="submit" className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-colors">
                  Send Verification Code
                </button>
              </div>
              <div className="text-center text-sm">
                <button type="button" onClick={() => switchMode('login')} className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
                  Back to login
                </button>
              </div>
            </form>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleConfirmVerify}>
              {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}
              {msg && <div className="text-green-600 text-sm text-center bg-green-50 p-2 rounded">{msg}</div>}
              <div className="text-sm text-center text-gray-600 mb-4">
                We've sent a 6-digit verification code to <span className="font-semibold">{email}</span>. Please enter it below.
              </div>
              <div className="rounded-md shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                  <input type="text" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" placeholder="123456" value={otp} onChange={e => setOtp(e.target.value)} />
                </div>
              </div>
              <div>
                <button type="submit" className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-colors">
                  Verify Email
                </button>
              </div>
            </form>
          )
        )}
      </div>
    </div>
  );
}
