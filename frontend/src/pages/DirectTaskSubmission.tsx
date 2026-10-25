import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Upload,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Ticket,
  ArrowLeft,
  Send,
  X,
  Share2,
  Download,
  Sparkles,
  ShieldCheck,
  History,
  QrCode
} from 'lucide-react';
import { Logo } from '../components/Brand';

interface LiveTask {
  id: number;
  event_id: number;
  title: string;
  instructions: string;
  description?: string;
  deadline: string;
  timezone: string;
  target_audience: string;
  submission_method: string;
  allowed_file_types?: string;
  max_file_size_mb: number;
  review_required: boolean;
  ai_verification_enabled: boolean;
  require_url: boolean;
  deliverable_checklist?: string[];
  scoring_rubric?: any;
  status: string;
  direct_submit_url?: string;
}

interface TaskSubmissionVersion {
  id: number;
  version_number: number;
  submission_text?: string;
  submission_url?: string;
  file_url?: string;
  file_name?: string;
  file_size_bytes?: number;
  status: string;
  ai_status?: string;
  ai_assessment?: any;
  organizer_feedback?: string;
  submitted_at: string;
}

interface TaskSubmission {
  id: number;
  task_id: number;
  event_id: number;
  team_id?: number;
  team_name?: string;
  registration_id: number;
  submitter_name?: string;
  submitter_email?: string;
  submission_text?: string;
  submission_url?: string;
  file_url?: string;
  file_name?: string;
  file_size_bytes?: number;
  status: string;
  is_late: boolean;
  version?: number;
  ai_status?: string;
  ai_assessment?: any;
  ai_verified_at?: string;
  organizer_feedback?: string;
  organizer_decision?: string;
  organizer_override_reason?: string;
  reviewed_at?: string;
  submitted_at: string;
  versions?: TaskSubmissionVersion[];
}

interface DirectTaskData {
  task: LiveTask;
  event_id: number;
  event_title: string;
  event_status: string;
  my_submission?: TaskSubmission | null;
  time_remaining_seconds: number;
  is_expired: boolean;
  is_registered: boolean;
  participant_name?: string | null;
  team_name?: string | null;
  ticket_code?: string | null;
}

export default function DirectTaskSubmission() {
  const { eventId, taskId } = useParams<{ eventId: string; taskId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Authentication & Ticket State
  const queryTicket = searchParams.get('ticket') || searchParams.get('ticket_code') || '';
  const [ticketInput, setTicketInput] = useState<string>(
    queryTicket || localStorage.getItem(`eventiva_ticket_${eventId}`) || ''
  );
  const [activeTicket, setActiveTicket] = useState<string>(
    queryTicket || localStorage.getItem(`eventiva_ticket_${eventId}`) || ''
  );
  const [showTicketModal, setShowTicketModal] = useState<boolean>(false);

  // Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [taskData, setTaskData] = useState<DirectTaskData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [submissionText, setSubmissionText] = useState<string>('');
  const [submissionUrl, setSubmissionUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Ticking Countdown
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch task portal data
  const loadTaskData = useCallback(async (isRefresh = false) => {
    if (!eventId || !taskId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const params: Record<string, string> = {};
      if (activeTicket) params['ticket_code'] = activeTicket.trim();

      const res = await axios.get<DirectTaskData>(
        `/api/events/${eventId}/tasks/${taskId}/public`,
        { headers, params }
      );

      setTaskData(res.data);

      if (res.data.is_registered && res.data.ticket_code) {
        localStorage.setItem(`eventiva_ticket_${eventId}`, res.data.ticket_code);
        if (!activeTicket) setActiveTicket(res.data.ticket_code);
      }

      // Pre-fill form if existing submission present
      if (res.data.my_submission) {
        setSubmissionText(res.data.my_submission.submission_text || '');
        setSubmissionUrl(res.data.my_submission.submission_url || '');
      }
    } catch (err: any) {
      console.error('Failed to load task details:', err);
      setError(err.response?.data?.detail || 'Unable to retrieve task submission portal.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, taskId, activeTicket]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  // Periodic polling every 15s to update AI status or reviews live
  useEffect(() => {
    const poll = setInterval(() => {
      loadTaskData(true);
    }, 15000);
    return () => clearInterval(poll);
  }, [loadTaskData]);

  // Ticket identification
  const handleVerifyTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketInput.trim()) return;
    const clean = ticketInput.trim().toUpperCase();
    setActiveTicket(clean);
    localStorage.setItem(`eventiva_ticket_${eventId}`, clean);
    setSearchParams({ ticket: clean });
    setShowTicketModal(false);
  };

  const handleClearTicket = () => {
    localStorage.removeItem(`eventiva_ticket_${eventId}`);
    setActiveTicket('');
    setTicketInput('');
    setSearchParams({});
  };

  // Submit work
  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !taskId || !taskData) return;

    if (!taskData.is_registered && !activeTicket) {
      setShowTicketModal(true);
      setSubmitError('Please verify your ticket code before submitting work.');
      return;
    }

    if (taskData.task.require_url && (!submissionUrl || !submissionUrl.trim())) {
      setSubmitError('A project repository or demo URL is required for this task.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const formData = new FormData();
      if (activeTicket) formData.append('ticket_code', activeTicket.trim());
      if (submissionText.trim()) formData.append('submission_text', submissionText.trim());
      if (submissionUrl.trim()) formData.append('submission_url', submissionUrl.trim());
      if (selectedFile) formData.append('file', selectedFile);

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await axios.post(
        `/api/events/${eventId}/tasks/${taskId}/submit`,
        formData,
        { headers }
      );

      setSubmitSuccess('Submission successfully recorded! AI verification is now processing your deliverables.');
      setSelectedFile(null);
      loadTaskData(true);
    } catch (err: any) {
      console.error('Submission error:', err);
      setSubmitError(err.response?.data?.detail || 'Failed to submit work. Please check file format and size.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format countdown
  const formatCountdown = (deadlineStr: string) => {
    const deadlineTime = new Date(deadlineStr).getTime();
    const diff = Math.floor((deadlineTime - currentTime) / 1000);

    if (diff <= 0) {
      const pastSeconds = Math.abs(diff);
      const hours = Math.floor(pastSeconds / 3600);
      const minutes = Math.floor((pastSeconds % 3600) / 60);
      return {
        expired: true,
        text: `Closed ${hours > 0 ? `${hours}h ` : ''}${minutes}m ago`
      };
    }

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    let text = '';
    if (days > 0) text += `${days}d `;
    text += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return {
      expired: false,
      text,
      isUrgent: diff <= 1800
    };
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const shareUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
        <h2 className="text-xl font-bold">Opening Task Submission Portal...</h2>
        <p className="text-sm text-slate-400 mt-1">Connecting to live deadline and verification engine.</p>
      </div>
    );
  }

  if (error || !taskData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Task Submission Unavailable</h2>
          <p className="text-sm text-slate-300 mb-6">{error || 'This task could not be found or has concluded.'}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => loadTaskData()}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm transition"
            >
              Retry Connection
            </button>
            <Link
              to={`/events/${eventId}/live`}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 font-medium text-sm transition text-slate-200"
            >
              Return to Live Event Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { task, my_submission } = taskData;
  const countdown = formatCountdown(task.deadline);
  const checklist = task.deliverable_checklist || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={`/events/${eventId}/live`} className="hover:opacity-80 transition">
              <Logo />
            </Link>
            <div className="h-5 w-px bg-slate-700 hidden sm:block" />
            <Link
              to={`/events/${eventId}/live`}
              className="text-xs font-semibold text-slate-400 hover:text-indigo-400 transition flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Live Hub</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {/* Share Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
              title="Share task link & QR code"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Participant Identity Badge */}
            {taskData.is_registered ? (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
                <Ticket className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className="text-left hidden sm:block">
                  <div className="font-bold text-slate-200 truncate max-w-[130px]">
                    {taskData.participant_name}
                  </div>
                  {taskData.team_name && (
                    <div className="text-[10px] text-indigo-300 font-semibold truncate max-w-[130px]">
                      Team: {taskData.team_name}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleClearTicket}
                  className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition"
                  title="Switch attendee ticket"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowTicketModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Enter Ticket Code</span>
              </button>
            )}

            {/* Live Refresh */}
            <button
              onClick={() => loadTaskData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
              title="Refresh task data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Task Hero Banner */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 px-4 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-indigo-950 border border-indigo-800 text-indigo-300 px-2.5 py-0.5 rounded-full">
                {taskData.event_title}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full">
                Target: {task.target_audience}
              </span>
              {task.ai_verification_enabled && (
                <span className="text-[11px] font-bold uppercase tracking-wider bg-purple-950 border border-purple-800 text-purple-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>AI Verification</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {task.title}
            </h1>

            {task.description && (
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>

          {/* Countdown Clock Tile */}
          <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center min-w-[200px] shrink-0 ${
            countdown.expired
              ? 'bg-slate-800/60 border-slate-700 text-slate-400'
              : countdown.isUrgent
              ? 'bg-rose-950/60 border-rose-800 text-rose-300 animate-pulse'
              : 'bg-indigo-950/50 border-indigo-800/80 text-indigo-300'
          }`}>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              <span>{countdown.expired ? 'Deadline Ended' : 'Time Remaining'}</span>
            </div>
            <div className="text-2xl font-mono font-black mt-1.5 tracking-wider">
              {countdown.text}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Due {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({task.timezone})
            </div>
          </div>
        </div>
      </section>

      {/* Main Task Body */}
      <main className="max-w-5xl mx-auto w-full px-4 py-8 space-y-8 flex-1">
        {/* INSTRUCTIONS & DELIVERABLES */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            Organizer Instructions & Deliverables
          </h2>

          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
            {task.instructions}
          </div>

          {/* Required Checklist Items */}
          {checklist.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Deliverable Checklist Criteria
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {checklist.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-slate-950/50 border border-slate-800 p-2.5 rounded-xl text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Specification Pills */}
          <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-400">
            {task.allowed_file_types && (
              <span className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                <strong className="text-slate-300">Allowed Formats:</strong> {task.allowed_file_types}
              </span>
            )}
            <span className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <strong className="text-slate-300">Max File Size:</strong> {task.max_file_size_mb} MB
            </span>
            {task.require_url && (
              <span className="bg-amber-950/40 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-800/60 font-semibold">
                ★ Project / Repository Link Required
              </span>
            )}
            {task.review_required && (
              <span className="bg-indigo-950/40 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-800/60">
                ★ Organizer Approval Required
              </span>
            )}
          </div>
        </div>

        {/* CURRENT RECORDED SUBMISSION & AI ASSESSMENT (If Present) */}
        {my_submission && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Your Submission Status</h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  Version {my_submission.version || 1}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  my_submission.status === 'Verified' || my_submission.status === 'Completed'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : my_submission.status === 'Correction Required'
                    ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                    : my_submission.status === 'Manual Review Required' || my_submission.status === 'Awaiting Organizer Approval'
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {my_submission.status}
                </span>

                {my_submission.versions && my_submission.versions.length > 1 && (
                  <button
                    onClick={() => setShowHistoryModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Revisions ({my_submission.versions.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* ORGANIZER FEEDBACK / CORRECTION REQUEST */}
            {my_submission.organizer_feedback && (
              <div className={`p-4 rounded-xl border ${
                my_submission.status === 'Correction Required'
                  ? 'bg-amber-950/40 border-amber-600/80 text-amber-200'
                  : 'bg-indigo-950/40 border-indigo-800 text-indigo-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Organizer Review Feedback</span>
                </div>
                <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed mt-1">
                  {my_submission.organizer_feedback}
                </p>
              </div>
            )}

            {/* AI AUTOMATIC ASSESSMENT CARD */}
            {my_submission.ai_assessment && (
              <div className="bg-slate-950/70 border border-purple-900/50 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      AI Automatic Verification Result
                    </span>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                    my_submission.ai_assessment.overall_result === 'Passed'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : my_submission.ai_assessment.overall_result === 'Needs Correction'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-purple-950 text-purple-300 border border-purple-800'
                  }`}>
                    {my_submission.ai_assessment.overall_result}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {my_submission.ai_assessment.concise_explanation}
                </p>

                {/* Checklist Breakdown */}
                {my_submission.ai_assessment.checklist_assessment && my_submission.ai_assessment.checklist_assessment.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Requirements Evaluation
                    </span>
                    <div className="space-y-1.5">
                      {my_submission.ai_assessment.checklist_assessment.map((chk: any, i: number) => (
                        <div key={i} className="flex items-start justify-between gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-xs">
                          <div>
                            <span className="font-semibold text-slate-200">{chk.item}</span>
                            {chk.evidence && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{chk.evidence}</p>
                            )}
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                            chk.status === 'Met'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : chk.status === 'Not Met'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {chk.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submitted File & Link Display */}
            <div className="space-y-2 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Recorded Deliverables
              </span>
              {my_submission.file_name && (
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="font-mono text-slate-200 truncate">{my_submission.file_name}</span>
                    <span className="text-slate-500">({formatBytes(my_submission.file_size_bytes)})</span>
                  </div>
                  {my_submission.file_url && (
                    <a
                      href={my_submission.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 font-bold ml-2 shrink-0 flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  )}
                </div>
              )}

              {my_submission.submission_url && (
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 truncate">
                    <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
                    <a
                      href={my_submission.submission_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:underline truncate"
                    >
                      {my_submission.submission_url}
                    </a>
                  </div>
                </div>
              )}

              {my_submission.submission_text && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-slate-300 whitespace-pre-wrap">
                  {my_submission.submission_text}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBMISSION FORM */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>{my_submission ? 'Resubmit / Update Deliverables' : 'Submit Your Work'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload required files, provide repository links, and submit prior to the deadline cutoff.
            </p>
          </div>

          {submitError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{submitSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSubmitWork} className="space-y-5">
            {/* File Upload Dropzone */}
            {(task.submission_method.includes('file') ||
              task.submission_method.includes('both') ||
              task.submission_method.includes('all')) && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Deliverable File Upload {task.allowed_file_types && `(${task.allowed_file_types})`}
                </label>
                <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center hover:border-indigo-500 transition bg-slate-950/50">
                  <input
                    type="file"
                    id="direct-file-input"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <label htmlFor="direct-file-input" className="cursor-pointer block">
                    <Upload className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                    {selectedFile ? (
                      <div className="text-xs font-mono text-emerald-400 font-bold truncate">
                        Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs sm:text-sm font-bold text-indigo-400 hover:underline">
                          Click to browse file
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Allowed: {task.allowed_file_types || 'Any safe format'} • Max {task.max_file_size_mb} MB
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}

            {/* Project / Repository URL Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Project Repository / Demo Link {task.require_url && <span className="text-rose-400">*</span>}
                </label>
                {task.require_url && (
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-800">
                    Required
                  </span>
                )}
              </div>
              <input
                type="url"
                required={task.require_url}
                placeholder="https://github.com/... or https://demo.app/..."
                value={submissionUrl}
                onChange={(e) => setSubmissionUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Notes Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Submission Notes & Reviewer Comments
              </label>
              <textarea
                rows={4}
                placeholder="Detail setup instructions, account credentials, or comments for the evaluation team..."
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Participant Identification reminder */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Submitting on behalf of:</span>
              <span className="font-bold text-indigo-300">
                {taskData.participant_name || activeTicket || 'Authenticated Participant'}
                {taskData.team_name ? ` (Team: ${taskData.team_name})` : ''}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving & Verifying...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{my_submission ? 'Resubmit Deliverables' : 'Turn In Work'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* MODAL: IDENTIFY ATTENDEE */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowTicketModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl">
                <Ticket className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Attendee Verification</h3>
                <p className="text-xs text-slate-400">Enter your ticket code to unlock submission tracking.</p>
              </div>
            </div>

            <form onSubmit={handleVerifyTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Ticket Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EVT-ABCD-1234"
                  value={ticketInput}
                  onChange={(e) => setTicketInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 uppercase tracking-wider"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-xs"
                >
                  Authenticate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VERSION HISTORY */}
      {showHistoryModal && my_submission?.versions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-400" />
              <span>Submission Revision History</span>
            </h3>

            <div className="space-y-3">
              {my_submission.versions.map((ver) => (
                <div key={ver.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300">Revision {ver.version_number}</span>
                    <span className="text-slate-500">{new Date(ver.submitted_at).toLocaleString()}</span>
                  </div>
                  {ver.file_name && (
                    <div className="text-slate-300">File: {ver.file_name} ({formatBytes(ver.file_size_bytes)})</div>
                  )}
                  {ver.submission_url && (
                    <div className="text-emerald-400 truncate">URL: {ver.submission_url}</div>
                  )}
                  {ver.organizer_feedback && (
                    <div className="text-amber-300 bg-amber-950/30 p-2 rounded-lg border border-amber-900/40">
                      Feedback: {ver.organizer_feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHARE & QR CODE */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-center">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Share Direct Submission Link</h3>
            <p className="text-xs text-slate-400 mb-4">{task.title}</p>

            {/* Direct Link Box */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2.5 rounded-xl mb-4">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent text-xs text-slate-300 font-mono w-full focus:outline-hidden"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 transition"
              >
                {copiedLink ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-lg mx-auto mb-4">
              {/* Quick SVG QR code representation */}
              <div className="w-40 h-40 flex items-center justify-center text-slate-950">
                <QrCode className="w-36 h-36" />
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Participants can scan this QR code on mobile devices to open this task submission page directly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
