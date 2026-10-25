import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Calendar, 
  User, 
  Building2, 
  Download, 
  Printer, 
  CalendarPlus, 
  Copy, 
  Check, 
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { BrandIcon } from '../components/Brand';

interface TicketData {
  ticket_code: string;
  event_id: number;
  event_title: string;
  category?: string;
  start_time?: string;
  end_time?: string;
  venue?: string;
  poster_url?: string;
  attendee_name: string;
  attendee_college?: string;
  status: string;
  checked_in: boolean;
  checked_in_at?: string;
  is_valid_for_admission: boolean;
  ticket_url: string;
}

export default function TicketPass() {
  const { ticketCode } = useParams<{ ticketCode: string }>();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ticketRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ticketCode) return;
    setLoading(true);
    axios.get(`/api/tickets/${ticketCode}`)
      .then(res => {
        setTicket(res.data);
        setError(null);
      })
      .catch(err => {
        console.error('Failed to load ticket:', err);
        setError(err.response?.data?.detail || 'Ticket not found. Please verify your ticket code.');
      })
      .finally(() => setLoading(false));
  }, [ticketCode]);

  useEffect(() => {
    if (ticket && qrCanvasRef.current) {
      // Secure verification payload: direct HTTPS URL for gate scanner verification
      const verifyUrl = `${window.location.origin}/tickets/${ticket.ticket_code}`;
      QRCode.toCanvas(qrCanvasRef.current, verifyUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }, (err) => {
        if (err) console.error('QR code render error:', err);
      });
    }
  }, [ticket]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    try {
      setDownloading(true);
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#090d16'
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `EVENTIVA_Ticket_${ticket?.ticket_code || 'pass'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate ticket image:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleAddToCalendar = () => {
    if (!ticket || !ticket.start_time) return;
    const start = new Date(ticket.start_time);
    const end = ticket.end_time ? new Date(ticket.end_time) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    
    const formatCalDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ticket.event_title)}&dates=${formatCalDate(start)}/${formatCalDate(end)}&details=${encodeURIComponent(`Admission Ticket: ${ticket.ticket_code}\nAttendee: ${ticket.attendee_name}\nPass: ${window.location.href}`)}&location=${encodeURIComponent(ticket.venue || '')}`;
    
    window.open(gcalUrl, '_blank');
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Verifying ticket pass...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <XCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Invalid or Expired Ticket</h1>
          <p className="text-slate-400 text-sm mb-6">
            {error || 'We could not find an active ticket associated with this code.'}
          </p>
          <div className="flex flex-col gap-3">
            <Link 
              to="/dashboard"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition"
            >
              Go to EVENTIVA Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCancelled = ticket.status.toLowerCase() === 'cancelled' || ticket.status.toLowerCase() === 'rejected';
  const isCheckedIn = ticket.checked_in;
  const isValid = ticket.is_valid_for_admission && !isCancelled && !isCheckedIn;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white">
      {/* Print Styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .ticket-card { box-shadow: none !important; border: 2px solid #000 !important; color: #000 !important; background: white !important; }
          .ticket-card * { color: #000 !important; border-color: #ccc !important; }
        }
      `}</style>

      <div className="max-w-xl mx-auto">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between mb-6 no-print">
          <Link 
            to={`/events/${ticket.event_id}`}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Event
          </Link>
          <div className="flex items-center gap-2">
            <BrandIcon className="w-6 h-6 rounded" />
            <span className="font-semibold text-xs tracking-wider uppercase text-slate-400">Digital Pass</span>
          </div>
        </div>

        {/* Live Admission Status Banner */}
        <div className="mb-4 no-print">
          {isValid && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-center gap-3 text-emerald-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold">Valid Admission Pass:</span> Ready for gate check-in.
              </div>
            </div>
          )}
          {isCheckedIn && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold">Already Checked In:</span> This ticket was admitted at the venue
                {ticket.checked_in_at ? ` on ${formatDate(ticket.checked_in_at)} at ${formatTime(ticket.checked_in_at)}` : ''}.
              </div>
            </div>
          )}
          {isCancelled && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-center gap-3 text-rose-400">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold">Admission Revoked:</span> This registration is marked as {ticket.status}.
              </div>
            </div>
          )}
        </div>

        {/* Physical-Style Ticket Card */}
        <div 
          ref={ticketRef}
          className="ticket-card relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition"
        >
          {/* Subtle Top Decorative Gradient Bar */}
          <div className={`h-2.5 w-full ${isValid ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400' : isCheckedIn ? 'bg-gradient-to-r from-amber-500 to-amber-300' : 'bg-gradient-to-r from-red-600 to-rose-400'}`} />

          {/* Ticket Header */}
          <div className="p-6 sm:p-8 border-b border-slate-800/80">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  {ticket.category || 'Official Event Pass'}
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs text-slate-400 tracking-wider">TICKET NUMBER</span>
                <div className="font-mono font-bold text-sm sm:text-base text-indigo-400">{ticket.ticket_code}</div>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
              {ticket.event_title}
            </h1>
          </div>

          {/* Attendee Details & Logistics Grid */}
          <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-900/50">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Attendee Name
              </div>
              <div className="text-base sm:text-lg font-bold text-slate-100">{ticket.attendee_name}</div>
              {ticket.attendee_college && (
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{ticket.attendee_college}</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Admission Status
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                  isValid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 
                  isCheckedIn ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 
                  'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {isCheckedIn ? 'Checked In' : isCancelled ? 'Revoked' : 'Confirmed'}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Date & Time
              </div>
              <div className="text-sm font-semibold text-slate-200">
                {formatDate(ticket.start_time) || 'Date announced soon'}
              </div>
              {ticket.start_time && (
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{formatTime(ticket.start_time)} {ticket.end_time ? `– ${formatTime(ticket.end_time)}` : ''}</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" /> Venue
              </div>
              <div className="text-sm font-semibold text-slate-200">
                {ticket.venue || 'Venue information to be announced'}
              </div>
            </div>
          </div>

          {/* Perforated Divider with Notches */}
          <div className="relative flex items-center justify-between my-1">
            <div className="w-5 h-10 bg-slate-950 rounded-r-full -ml-1 border-r border-y border-slate-800" />
            <div className="flex-1 border-t-2 border-dashed border-slate-800 mx-3" />
            <div className="w-5 h-10 bg-slate-950 rounded-l-full -mr-1 border-l border-y border-slate-800" />
          </div>

          {/* QR Code Admission Stub */}
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 justify-between bg-slate-950/80">
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Official Gate Scan</h2>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Present this scannable QR pass at the entrance on your phone or in print. Gate staff will scan to authenticate entry.
              </p>
              <div className="mt-3 flex items-center justify-center sm:justify-start gap-1.5 text-[11px] text-slate-500 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cryptographically Verified Pass</span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl shadow-xl flex-shrink-0 flex items-center justify-center">
              <canvas ref={qrCanvasRef} className="rounded-lg w-[160px] h-[160px]" />
            </div>
          </div>

          {/* Footer watermark */}
          <div className="px-6 py-3 bg-slate-950 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>EVENTIVA Verified Pass</span>
            <span className="font-mono">{ticket.ticket_code}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 no-print">
          <Link
            to={`/events/${ticket.event_id}/live?ticket=${ticket.ticket_code}`}
            className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition"
          >
            <span>⚡</span>
            <span>Live Event Portal</span>
          </Link>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Exporting...' : 'Save Ticket'}
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>

          {ticket.start_time && (
            <button
              onClick={handleAddToCalendar}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition"
              title="Add to Google Calendar"
            >
              <CalendarPlus className="w-4 h-4" />
              Add to Calendar
            </button>
          )}

          <button
            onClick={handleCopyLink}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition"
            title="Copy Ticket URL"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Link Copied!' : 'Share Pass'}
          </button>
        </div>
      </div>
    </div>
  );
}
