import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Radio,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Upload,
  ExternalLink,
  Calendar,
  RefreshCw,
  AlertCircle,
  Ticket,
  MessageSquare,
  ArrowLeft,
  Check,
  Send,
  X
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
  status: string;
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
  submitted_at: string;
  organizer_feedback?: string;
  reviewed_at?: string;
}

interface ParticipantTaskView {
  task: LiveTask;
  my_submission?: TaskSubmission | null;
  time_remaining_seconds: number;
  is_expired: boolean;
}

interface Announcement {
  id: number;
  event_id: number;
  title: string;
  message: string;
  priority: 'normal' | 'important' | 'urgent';
  target_audience: string;
  recipient_count: number;
  delivered_count: number;
  created_at: string;
}

interface TimelineEntry {
  id: number;
  event_id: number;
  title: string;
  description?: string;
  scheduled_time: string;
  end_time?: string;
  entry_type: 'activity' | 'deadline' | 'submission_window' | 'announcement';
  task_id?: number;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  order: number;
}

interface LivePortalData {
  event_id: number;
  event_title: string;
  event_status: string;
  announcements: Announcement[];
  urgent_update?: Announcement | null;
  tasks: ParticipantTaskView[];
  timeline: TimelineEntry[];
  is_registered: boolean;
  participant_name?: string | null;
  team_name?: string | null;
  ticket_code?: string | null;
}

export default function ParticipantLiveDashboard() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Identification state
  const queryTicket = searchParams.get('ticket') || searchParams.get('ticket_code') || '';
  const [ticketInput, setTicketInput] = useState<string>(
    queryTicket || localStorage.getItem(`eventiva_ticket_${id}`) || ''
  );
  const [activeTicket, setActiveTicket] = useState<string>(
    queryTicket || localStorage.getItem(`eventiva_ticket_${id}`) || ''
  );
  const [showIdentifyModal, setShowIdentifyModal] = useState<boolean>(false);

  // Portal data state
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [portalData, setPortalData] = useState<LivePortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active navigation tab on mobile/desktop
  const [activeTab, setActiveTab] = useState<'tasks' | 'announcements' | 'timeline'>('tasks');

  // Submissions state
  const [submittingTaskId, setSubmittingTaskId] = useState<number | null>(null);
  const [activeSubmissionTask, setActiveSubmissionTask] = useState<ParticipantTaskView | null>(null);
  const [submissionText, setSubmissionText] = useState<string>('');
  const [submissionUrl, setSubmissionUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);

  // Ticked countdowns (tick every second)
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live portal data
  const loadPortalData = useCallback(async (isRefresh = false) => {
    if (!id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const params: Record<string, string> = {};
      if (activeTicket) params['ticket_code'] = activeTicket.trim();

      const res = await axios.get<LivePortalData>(`/api/events/${id}/live-portal`, {
        headers,
        params
      });

      setPortalData(res.data);

      // Save identified ticket if verified
      if (res.data.is_registered && res.data.ticket_code) {
        localStorage.setItem(`eventiva_ticket_${id}`, res.data.ticket_code);
        if (!activeTicket) {
          setActiveTicket(res.data.ticket_code);
        }
      }
    } catch (err: any) {
      console.error('Failed to load live portal data:', err);
      setError(err.response?.data?.detail || 'Unable to connect to the live event feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, activeTicket]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  // Periodic poll every 20 seconds for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadPortalData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [loadPortalData]);

  // Handle identification ticket submission
  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketInput.trim()) return;
    const cleanTicket = ticketInput.trim().toUpperCase();
    setActiveTicket(cleanTicket);
    localStorage.setItem(`eventiva_ticket_${id}`, cleanTicket);
    setSearchParams({ ticket: cleanTicket });
    setShowIdentifyModal(false);
  };

  const handleClearIdentification = () => {
    localStorage.removeItem(`eventiva_ticket_${id}`);
    setActiveTicket('');
    setTicketInput('');
    setSearchParams({});
  };

  // Open submission modal for a task
  const handleOpenSubmission = (taskView: ParticipantTaskView) => {
    setActiveSubmissionTask(taskView);
    setSubmissionError(null);
    setSubmissionSuccess(null);
    setSelectedFile(null);

    // Pre-fill existing submission values if available
    if (taskView.my_submission) {
      setSubmissionText(taskView.my_submission.submission_text || '');
      setSubmissionUrl(taskView.my_submission.submission_url || '');
    } else {
      setSubmissionText('');
      setSubmissionUrl('');
    }
  };

  // Submit task work
  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmissionTask || !id) return;

    if (!portalData?.is_registered && !activeTicket) {
      setShowIdentifyModal(true);
      setSubmissionError('Please enter your Ticket Code or log in to submit your work.');
      return;
    }

    setSubmittingTaskId(activeSubmissionTask.task.id);
    setSubmissionError(null);
    setSubmissionSuccess(null);

    try {
      const formData = new FormData();
      if (activeTicket) {
        formData.append('ticket_code', activeTicket.trim());
      }
      if (submissionText.trim()) {
        formData.append('submission_text', submissionText.trim());
      }
      if (submissionUrl.trim()) {
        formData.append('submission_url', submissionUrl.trim());
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await axios.post(
        `/api/events/${id}/tasks/${activeSubmissionTask.task.id}/submit`,
        formData,
        { headers }
      );

      setSubmissionSuccess('Work submitted successfully! Your submission has been recorded.');
      setTimeout(() => {
        setActiveSubmissionTask(null);
        loadPortalData(true);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to submit work:', err);
      setSubmissionError(err.response?.data?.detail || 'Failed to submit work. Please review instructions and try again.');
    } finally {
      setSubmittingTaskId(null);
    }
  };

  // Format countdown string
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
      isUrgent: diff <= 1800 // less than 30 mins
    };
  };

  // Get status badge UI
  const getStatusBadge = (status: string, isLate: boolean) => {
    switch (status) {
      case 'Verified':
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case 'Correction Required':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            Correction Required
          </span>
        );
      case 'Submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <Check className="w-3.5 h-3.5" />
            Submitted {isLate ? '(Late)' : ''}
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5" />
            In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300">
            Not Started
          </span>
        );
    }
  };

  // Format file size
  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
        <h2 className="text-xl font-bold">Connecting to Live Event Feed...</h2>
        <p className="text-sm text-slate-400 mt-1">Fetching live tasks, announcements, and timelines.</p>
      </div>
    );
  }

  if (error || !portalData) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Live Portal Unavailable</h2>
          <p className="text-sm text-slate-300 mb-6">{error || 'Event could not be found or live operations have concluded.'}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => loadPortalData()}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-sm transition"
            >
              Retry Connection
            </button>
            <Link
              to="/"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 font-medium text-sm transition text-slate-200"
            >
              Return to EVENTIVA
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Live Broadcast Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={`/events/${id}`} className="hover:opacity-80 transition">
              <Logo />
            </Link>
            <div className="h-5 w-px bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                LIVE HUB
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Participant Identity Badge */}
            {portalData.is_registered ? (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
                <Ticket className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className="text-left hidden sm:block">
                  <div className="font-bold text-slate-200 truncate max-w-[150px]">
                    {portalData.participant_name}
                  </div>
                  {portalData.team_name && (
                    <div className="text-[10px] text-indigo-300 font-semibold truncate max-w-[150px]">
                      Team: {portalData.team_name}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleClearIdentification}
                  className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition"
                  title="Switch attendee ticket"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowIdentifyModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Enter Ticket Code</span>
              </button>
            )}

            {/* Live Refresh Button */}
            <button
              onClick={() => loadPortalData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
              title="Refresh live feed"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Urgent Update Banner (High Priority) */}
      {portalData.urgent_update && (
        <div className="bg-rose-950/90 border-b border-rose-800 text-rose-100 px-4 py-3 shadow-lg animate-pulse-subtle">
          <div className="max-w-6xl mx-auto flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-full">
                  Urgent Broadcast
                </span>
                <span className="text-xs text-rose-300 font-medium">
                  {new Date(portalData.urgent_update.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mt-1">
                {portalData.urgent_update.title}
              </h4>
              <p className="text-xs text-rose-200 mt-0.5 whitespace-pre-wrap leading-relaxed">
                {portalData.urgent_update.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 px-4 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Link
                to={`/events/${id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Event Page
              </Link>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-medium text-slate-400">
                Live Participant Operations
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {portalData.event_title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Track real-time instructions, submit project milestones before deadlines, and receive instant organizer feedback.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 self-start md:self-auto bg-slate-900 border border-slate-800 p-2 rounded-2xl">
            <div className="px-3 py-1.5 border-r border-slate-800 text-center">
              <div className="text-lg font-black text-indigo-400 leading-none">
                {portalData.tasks.length}
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">
                Tasks
              </div>
            </div>
            <div className="px-3 py-1.5 border-r border-slate-800 text-center">
              <div className="text-lg font-black text-emerald-400 leading-none">
                {portalData.tasks.filter(t => t.my_submission?.status === 'Submitted' || t.my_submission?.status === 'Verified' || t.my_submission?.status === 'Completed').length}
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">
                Done
              </div>
            </div>
            <div className="px-3 py-1.5 text-center">
              <div className="text-lg font-black text-amber-400 leading-none">
                {portalData.announcements.length}
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">
                Updates
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto mt-6 flex items-center gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
              activeTab === 'tasks'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Tasks & Deadlines</span>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-indigo-300">
              {portalData.tasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
              activeTab === 'announcements'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Announcements</span>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-amber-300">
              {portalData.announcements.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
              activeTab === 'timeline'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Event Timeline</span>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">
              {portalData.timeline.length}
            </span>
          </button>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto w-full px-4 py-6 flex-1">
        {/* TAB 1: TASKS & DEADLINES */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {!portalData.is_registered && (
              <div className="bg-slate-900 border border-indigo-900/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Identify with your Ticket Code</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Enter your ticket code to unlock individual or team submission tracking and real-time status updates.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIdentifyModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shrink-0"
                >
                  Enter Ticket Code
                </button>
              </div>
            )}

            {portalData.tasks.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-200">No Active Tasks Yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  The event organizers have not published any live tasks or submission checkpoints yet. They will appear here in real-time as the event progresses.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5">
                {portalData.tasks.map((taskView) => {
                  const countdown = formatCountdown(taskView.task.deadline);
                  const sub = taskView.my_submission;
                  const isCorrectionRequired = sub?.status === 'Correction Required';

                  return (
                    <div
                      key={taskView.task.id}
                      className={`bg-slate-900 rounded-2xl border transition shadow-sm overflow-hidden ${
                        isCorrectionRequired
                          ? 'border-amber-500/80 ring-1 ring-amber-500/30'
                          : countdown.isUrgent && !countdown.expired
                          ? 'border-rose-500/50'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Task Header */}
                      <div className="p-4 sm:p-6 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 uppercase tracking-wider">
                              Target: {taskView.task.target_audience}
                            </span>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              Method: {taskView.task.submission_method}
                            </span>
                            {sub && getStatusBadge(sub.status, sub.is_late)}
                          </div>

                          <h3 className="text-lg font-black text-white tracking-tight">
                            {taskView.task.title}
                          </h3>

                          {taskView.task.description && (
                            <p className="text-xs sm:text-sm text-slate-400 mt-1">
                              {taskView.task.description}
                            </p>
                          )}
                        </div>

                        {/* Live Countdown Clock */}
                        <div className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center min-w-[170px] ${
                          countdown.expired
                            ? 'bg-slate-800/50 border-slate-700 text-slate-400'
                            : countdown.isUrgent
                            ? 'bg-rose-950/60 border-rose-800 text-rose-300 animate-pulse'
                            : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300'
                        }`}>
                          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{countdown.expired ? 'Deadline Ended' : 'Time Left'}</span>
                          </div>
                          <div className="text-lg font-mono font-black mt-1 tracking-wider">
                            {countdown.text}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Due {new Date(taskView.task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({taskView.task.timezone})
                          </div>
                        </div>
                      </div>

                      {/* Instructions Section */}
                      <div className="p-4 sm:p-6 space-y-4">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            Submission Instructions
                          </h4>
                          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                            {taskView.task.instructions}
                          </div>
                        </div>

                        {/* Requirements Badges */}
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                          {taskView.task.allowed_file_types && (
                            <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                              <span className="font-bold text-slate-300">Allowed Formats:</span> {taskView.task.allowed_file_types}
                            </div>
                          )}
                          <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                            <span className="font-bold text-slate-300">Max File Size:</span> {taskView.task.max_file_size_mb} MB
                          </div>
                          {taskView.task.review_required && (
                            <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-indigo-300">
                              ★ Organizer Review Required
                            </div>
                          )}
                        </div>

                        {/* ORGANIZER FEEDBACK ALERT (If Correction Required or Feedback present) */}
                        {sub?.organizer_feedback && (
                          <div className={`p-4 rounded-xl border ${
                            isCorrectionRequired
                              ? 'bg-amber-950/40 border-amber-500/80 text-amber-200'
                              : 'bg-indigo-950/40 border-indigo-800 text-indigo-200'
                          }`}>
                            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-1">
                              {isCorrectionRequired ? (
                                <>
                                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                                  <span>Organizer Correction Request</span>
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                                  <span>Organizer Feedback</span>
                                </>
                              )}
                              {sub.reviewed_at && (
                                <span className="text-[10px] opacity-75 font-normal ml-auto">
                                  {new Date(sub.reviewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm whitespace-pre-wrap mt-1 leading-relaxed">
                              {sub.organizer_feedback}
                            </p>
                          </div>
                        )}

                        {/* Existing Submission Details */}
                        {sub && (
                          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                              <span className="font-bold text-slate-300">Recorded Submission:</span>
                              <span>Submitted: {new Date(sub.submitted_at).toLocaleString()}</span>
                            </div>

                            <div className="space-y-2 text-xs">
                              {sub.file_name && (
                                <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                                  <div className="flex items-center gap-2 truncate">
                                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                                    <span className="font-mono text-slate-200 truncate">{sub.file_name}</span>
                                    <span className="text-slate-500">({formatBytes(sub.file_size_bytes)})</span>
                                  </div>
                                  {sub.file_url && (
                                    <a
                                      href={sub.file_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-indigo-400 hover:text-indigo-300 font-bold ml-2 shrink-0 flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      View
                                    </a>
                                  )}
                                </div>
                              )}

                              {sub.submission_url && (
                                <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                                  <div className="flex items-center gap-2 truncate">
                                    <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <a
                                      href={sub.submission_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-emerald-400 hover:underline truncate"
                                    >
                                      {sub.submission_url}
                                    </a>
                                  </div>
                                </div>
                              )}

                              {sub.submission_text && (
                                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-300 whitespace-pre-wrap">
                                  {sub.submission_text}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Submission Action Button */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-slate-400">
                            {sub ? (
                              <span>You can update or resubmit your work at any time before final grading.</span>
                            ) : (
                              <span>Ready to turn in your work? Submit before the countdown completes.</span>
                            )}
                          </div>

                          <button
                            onClick={() => handleOpenSubmission(taskView)}
                            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-md ${
                              isCorrectionRequired
                                ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                                : sub
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                          >
                            <Upload className="w-4 h-4" />
                            <span>
                              {isCorrectionRequired
                                ? 'Submit Required Corrections'
                                : sub
                                ? 'Update Submission'
                                : 'Submit Work'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <div className="space-y-4">
            {portalData.announcements.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-200">No Announcements Yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Organizers will broadcast live event updates, room changes, and stage schedules here. Keep this tab open during the event.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {portalData.announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className={`bg-slate-900 rounded-2xl border p-5 transition ${
                      ann.priority === 'urgent'
                        ? 'border-rose-700/80 bg-rose-950/20'
                        : ann.priority === 'important'
                        ? 'border-amber-700/60 bg-amber-950/10'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            ann.priority === 'urgent'
                              ? 'bg-rose-600 text-white'
                              : ann.priority === 'important'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {ann.priority}
                        </span>
                        <span className="text-xs text-slate-400">
                          To: {ann.target_audience}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(ann.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white">
                      {ann.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                      {ann.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            {portalData.timeline.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-200">No Timeline Published</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  The schedule of live activities, submission windows, and judging sessions will appear here once released by organizers.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 border-l border-slate-800 space-y-8 my-4 ml-3">
                {portalData.timeline.map((entry) => {
                  const entryDate = new Date(entry.scheduled_time);

                  return (
                    <div key={entry.id} className="relative group">
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full border-2 transition ${
                          entry.status === 'Completed'
                            ? 'bg-emerald-500 border-emerald-400'
                            : entry.status === 'In Progress'
                            ? 'bg-indigo-500 border-indigo-400 animate-ping'
                            : 'bg-slate-900 border-slate-600'
                        }`}
                      />

                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 hover:border-slate-700 transition">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-indigo-400">
                              {entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-xs text-slate-500">
                              {entryDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                              {entry.entry_type.replace('_', ' ')}
                            </span>
                          </div>

                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              entry.status === 'Completed'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : entry.status === 'In Progress'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {entry.status}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-white">{entry.title}</h4>
                        {entry.description && (
                          <p className="text-xs sm:text-sm text-slate-400 mt-1 whitespace-pre-wrap leading-relaxed">
                            {entry.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL: IDENTIFY ATTENDEE / TICKET CODE */}
      {showIdentifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowIdentifyModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl">
                <Ticket className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Attendee Identification</h3>
                <p className="text-xs text-slate-400">Enter your Ticket Code to access submissions.</p>
              </div>
            </div>

            <form onSubmit={handleIdentify} className="space-y-4">
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
                <p className="text-[11px] text-slate-500 mt-1">
                  You can find your ticket code in your confirmation email or on your Digital Pass.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIdentifyModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-xs"
                >
                  Verify Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUBMISSION FORM */}
      {activeSubmissionTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8">
            <button
              onClick={() => setActiveSubmissionTask(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Submit Work: {activeSubmissionTask.task.title}
                </h3>
                <p className="text-xs text-slate-400">
                  Method: {activeSubmissionTask.task.submission_method} • Max {activeSubmissionTask.task.max_file_size_mb} MB
                </p>
              </div>
            </div>

            {submissionError && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{submissionError}</span>
              </div>
            )}

            {submissionSuccess && (
              <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{submissionSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitWork} className="space-y-4">
              {/* File Upload (if method allows file or combination) */}
              {(activeSubmissionTask.task.submission_method.includes('file') ||
                activeSubmissionTask.task.submission_method.includes('both') ||
                activeSubmissionTask.task.submission_method.includes('all')) && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Upload File {activeSubmissionTask.task.allowed_file_types && `(${activeSubmissionTask.task.allowed_file_types})`}
                  </label>
                  <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-indigo-500 transition bg-slate-950/50">
                    <input
                      type="file"
                      id="submission-file-input"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="submission-file-input" className="cursor-pointer block">
                      <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      {selectedFile ? (
                        <div className="text-xs font-mono text-emerald-400 font-bold truncate">
                          Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                        </div>
                      ) : (
                        <div>
                          <span className="text-xs font-bold text-indigo-400 hover:underline">
                            Click to browse file
                          </span>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Up to {activeSubmissionTask.task.max_file_size_mb} MB
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {/* URL Input (if method allows URL, link, or combination) */}
              {(activeSubmissionTask.task.submission_method.includes('url') ||
                activeSubmissionTask.task.submission_method.includes('link') ||
                activeSubmissionTask.task.submission_method.includes('both') ||
                activeSubmissionTask.task.submission_method.includes('all')) && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Submission URL / Repository / Demo Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/... or https://figma.com/..."
                    value={submissionUrl}
                    onChange={(e) => setSubmissionUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Text Area (if method allows text or notes) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Submission Notes & Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Provide any comments, access notes, or documentation for reviewers..."
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Submitter info reminder */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Submitting as:</span>
                <span className="font-bold text-indigo-300">
                  {portalData.participant_name || activeTicket || 'Authenticated Participant'}
                  {portalData.team_name ? ` (Team: ${portalData.team_name})` : ''}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubmissionTask(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTaskId !== null}
                  className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingTaskId !== null ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Turn In Work</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
