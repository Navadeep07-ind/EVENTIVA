import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Logo, PoweredByFooter } from '../components/Brand';

interface UnsubscribeInfo {
  event_title: string;
  attendee_name: string;
  email: string;
  unsubscribed_announcements: boolean;
}

export default function Unsubscribe() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<UnsubscribeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!token) return;
      try {
        const res = await axios.get(`/api/notifications/unsubscribe/${token}`);
        setInfo(res.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Invalid or expired unsubscribe link.');
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await axios.post(`/api/notifications/unsubscribe/${token}`);
      setSuccess(true);
      if (info) {
        setInfo({ ...info, unsubscribed_announcements: true });
      }
    } catch (err: any) {
      alert('Failed to update preferences: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">Checking email preferences...</p>
        </div>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-sm text-gray-600 mb-6">{error || 'Could not find registration record.'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" /> Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center">
          <Logo className="mx-auto" />
          <h2 className="mt-4 text-2xl font-black text-gray-900 tracking-tight">Notification Preferences</h2>
          <p className="text-xs text-gray-500 mt-1">Manage announcements for {info.event_title}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-6">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Event:</span>
              <span className="font-bold text-gray-900">{info.event_title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Attendee:</span>
              <span className="font-bold text-gray-900">{info.attendee_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email:</span>
              <span className="font-bold text-gray-900">{info.email}</span>
            </div>
          </div>

          {info.unsubscribed_announcements || success ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-emerald-900">Unsubscribed from Non-Essential Updates</h3>
              <p className="text-xs text-emerald-700">
                You will no longer receive marketing announcements or general reminders for this event.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                Click below if you prefer not to receive organizer announcements, tips, and event reminders for <strong>{info.event_title}</strong>.
              </p>

              <button
                type="button"
                disabled={submitting}
                onClick={handleUnsubscribe}
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {submitting ? 'Updating Preferences...' : 'Unsubscribe from Announcements'}
              </button>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <div className="text-[11px] text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700">Important Guarantee:</p>
              <p>
                Essential admission notifications—including your digital ticket pass, security tokens, and emergency venue or schedule shifts—will always be delivered so you never miss gate check-in.
              </p>
            </div>
          </div>
        </div>

        <PoweredByFooter />
      </div>
    </div>
  );
}
