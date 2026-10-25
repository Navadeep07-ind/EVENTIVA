import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Radio, 
  Send, 
  CheckSquare, 
  Clock, 
  AlertTriangle, 
  Upload, 
  ExternalLink, 
  Sparkles, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar, 
  ShieldAlert, 
  Bell, 
  MessageSquare,
  FileSpreadsheet,
  AlertCircle,
  Eye,
  X,
  Copy,
  Check,
  QrCode,
  FileText,
  CheckCircle2,
  RotateCw,
  ListChecks,
  History,
  Download
} from 'lucide-react';
import { 
  toLocalDatetimeInputValue, 
  formatDateLocal, 
  isDateInPast, 
  getTimeRemainingStr 
} from '../utils/dateUtils';

interface LiveOverview {
  event_id: number;
  event_title: string;
  event_status: string;
  total_registered: number;
  total_checked_in: number;
  total_teams: number;
  active_tasks_count: number;
  total_submissions_count: number;
  pending_reviews_count: number;
  recent_announcements: any[];
  upcoming_timeline: any[];
}

interface LiveTask {
  id: number;
  event_id: number;
  title: string;
  instructions: string;
  description?: string;
  deadline: string;
  timezone: string;
  target_audience: string;
  target_filter?: any;
  submission_method: string;
  allowed_file_types?: string;
  max_file_size_mb: number;
  review_required: boolean;
  ai_verification_enabled: boolean;
  require_url: boolean;
  deliverable_checklist?: string[];
  status: string;
  created_at: string;
  reminders: any[];
  submissions_count?: number;
  pending_reviews_count?: number;
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
  version: number;
  status: string;
  is_late: boolean;
  submitted_at: string;
  organizer_feedback?: string;
  ai_status?: string;
  ai_assessment?: any;
  ai_verified_at?: string;
  organizer_decision?: string;
  organizer_override_reason?: string;
  organizer_override_by?: number;
  versions?: TaskSubmissionVersion[];
}

interface TimelineEntry {
  id: number;
  event_id: number;
  title: string;
  description?: string;
  scheduled_time: string;
  end_time?: string;
  entry_type: string;
  task_id?: number;
  status: string;
  order: number;
}

export default function LiveControlCenter() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'tasks' | 'submissions' | 'announcements' | 'timeline'>('tasks');
  const [overview, setOverview] = useState<LiveOverview | null>(null);
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter for submissions tab
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<number | 'all'>('all');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<string>('all');

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LiveTask | null>(null);
  
  // Share & QR Modal
  const [shareModalTask, setShareModalTask] = useState<LiveTask | null>(null);
  const [copiedTaskId, setCopiedTaskId] = useState<number | null>(null);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);

  // Review & Override Modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState<TaskSubmission | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'Verified' | 'Correction Required' | 'Completed'>('Verified');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [overrideDecision, setOverrideDecision] = useState<'Approved' | 'Correction Required' | 'Reopened'>('Approved');
  const [overrideReason, setOverrideReason] = useState('');

  // AI Evidence Inspector Modal
  const [evidenceModalSub, setEvidenceModalSub] = useState<TaskSubmission | null>(null);

  // Version History Modal
  const [historyModalSub, setHistoryModalSub] = useState<TaskSubmission | null>(null);

  // AI Polish modal state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiRawInput, setAiRawInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Quick announcement modal state
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [announcementPriority, setAnnouncementPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [announcementAudience, setAnnouncementAudience] = useState<'all' | 'teams'>('all');
  const [urgentConfirmOpen, setUrgentConfirmOpen] = useState(false);

  // Timeline modal state
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState<TimelineEntry | null>(null);
  const [timelineTitle, setTimelineTitle] = useState('');
  const [timelineDesc, setTimelineDesc] = useState('');
  const [timelineType, setTimelineType] = useState('activity');
  const [timelineTime, setTimelineTime] = useState('');
  const [timelineStatus, setTimelineStatus] = useState('Scheduled');

  // Task form state
  const [newChecklistInput, setNewChecklistInput] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    instructions: '',
    description: '',
    deadline: '',
    timezone: 'UTC',
    target_audience: 'all',
    submission_method: 'file',
    allowed_file_types: '.pdf,.ppt,.pptx,.zip,.png,.jpg,.jpeg',
    max_file_size_mb: 25,
    review_required: true,
    ai_verification_enabled: true,
    require_url: false,
    deliverable_checklist: [
      'Presentation slide deck in PDF format',
      'System architecture diagram included',
      'Working demo or code repository link'
    ] as string[],
    reminder_offsets: [30, 10]
  });

  const token = localStorage.getItem('token');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      setError(null);
      const [overviewRes, tasksRes, timelineRes] = await Promise.all([
        axios.get(`/api/events/${id}/live/overview`, authHeaders),
        axios.get(`/api/events/${id}/live-tasks`, authHeaders),
        axios.get(`/api/events/${id}/timeline`, authHeaders)
      ]);

      setOverview(overviewRes.data);
      setTasks(tasksRes.data);
      setTimeline(timelineRes.data);

      if (tasksRes.data.length > 0) {
        const taskIdToFetch = selectedTaskFilter === 'all' ? tasksRes.data[0].id : selectedTaskFilter;
        fetchSubmissions(taskIdToFetch);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load Live Control Center data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSubmissions = async (taskId: number) => {
    try {
      const res = await axios.get(`/api/events/${id}/live-tasks/${taskId}/submissions`, authHeaders);
      setSubmissions(res.data);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 20000);
    return () => clearInterval(interval);
  }, [id]);

  const [sendingReminderTaskId, setSendingReminderTaskId] = useState<number | null>(null);

  const handleOpenNewTask = () => {
    setEditingTask(null);
    const inOneHour = toLocalDatetimeInputValue(new Date(Date.now() + 60 * 60 * 1000));
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    setTaskForm({
      title: '',
      instructions: '',
      description: '',
      deadline: inOneHour,
      timezone: browserTz,
      target_audience: 'all',
      submission_method: 'file',
      allowed_file_types: '.pdf,.ppt,.pptx,.zip,.png,.jpg,.jpeg',
      max_file_size_mb: 25,
      review_required: true,
      ai_verification_enabled: true,
      require_url: false,
      deliverable_checklist: [
        'Presentation slide deck in PDF format',
        'System architecture diagram included',
        'Working demo or code repository link'
      ],
      reminder_offsets: [30, 10]
    });
    setNewChecklistInput('');
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...taskForm,
        deadline: new Date(taskForm.deadline).toISOString(),
        max_file_size_mb: Number(taskForm.max_file_size_mb),
        reminder_offsets: (taskForm.reminder_offsets && taskForm.reminder_offsets.length > 0) ? taskForm.reminder_offsets : [30, 10]
      };

      if (editingTask) {
        await axios.put(`/api/events/${id}/live-tasks/${editingTask.id}`, payload, authHeaders);
      } else {
        await axios.post(`/api/events/${id}/live-tasks`, payload, authHeaders);
      }

      setIsTaskModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save task');
    }
  };

  const handleSendReminderNow = async (taskId: number, taskTitle: string) => {
    if (!confirm(`Send an immediate deadline reminder email for "${taskTitle}" to all registered participants who haven't submitted yet?`)) {
      return;
    }
    try {
      setSendingReminderTaskId(taskId);
      const res = await axios.post(`/api/events/${id}/live-tasks/${taskId}/reminders/send-now`, {}, authHeaders);
      if (res.data?.success) {
        alert(res.data.message || `Reminder successfully dispatched to ${res.data.delivered_count} recipient(s).`);
        loadData();
      } else {
        alert(res.data?.message || 'Failed to dispatch reminder');
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error sending reminder');
    } finally {
      setSendingReminderTaskId(null);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to cancel this task? Scheduled reminders will also be cancelled.')) return;
    try {
      await axios.delete(`/api/events/${id}/live-tasks/${taskId}`, authHeaders);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel task');
    }
  };

  const handleCopyTaskLink = (taskId: number) => {
    const url = `${window.location.origin}/events/${id}/tasks/${taskId}/submit`;
    navigator.clipboard.writeText(url);
    setCopiedTaskId(taskId);
    setTimeout(() => setCopiedTaskId(null), 2500);
  };

  const handleAIPolish = async () => {
    if (!aiRawInput.trim()) return;
    setAiLoading(true);
    try {
      const res = await axios.post('/api/ai/polish-task-instructions', {
        raw_text: aiRawInput,
        context_info: overview?.event_title
      }, authHeaders);

      setTaskForm(prev => ({
        ...prev,
        title: res.data.task_title || prev.title,
        instructions: res.data.instructions || prev.instructions,
        description: res.data.description || prev.description,
        submission_method: res.data.suggested_submission_method || prev.submission_method
      }));
      setIsAIModalOpen(false);
    } catch (err: any) {
      alert('AI assistant note: ' + (err.response?.data?.detail || 'Manual formatting applied.'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMsg.trim()) {
      alert('Please provide both title and announcement message');
      return;
    }

    if (announcementPriority === 'urgent' && !urgentConfirmOpen) {
      setUrgentConfirmOpen(true);
      return;
    }

    try {
      await axios.post(`/api/events/${id}/notifications/broadcast`, {
        title: announcementTitle.trim(),
        message: announcementMsg.trim(),
        target_audience: announcementAudience,
        priority: announcementPriority
      }, authHeaders);

      setIsAnnouncementModalOpen(false);
      setUrgentConfirmOpen(false);
      setAnnouncementTitle('');
      setAnnouncementMsg('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to dispatch announcement');
    }
  };

  const handleSaveTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: timelineTitle.trim(),
        description: timelineDesc.trim() || undefined,
        entry_type: timelineType,
        scheduled_time: new Date(timelineTime).toISOString(),
        status: timelineStatus
      };

      if (editingTimeline) {
        await axios.put(`/api/events/${id}/timeline/${editingTimeline.id}`, payload, authHeaders);
      } else {
        await axios.post(`/api/events/${id}/timeline`, payload, authHeaders);
      }

      setIsTimelineModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save timeline activity');
    }
  };

  const handleDeleteTimeline = async (entryId: number) => {
    if (!confirm('Remove this timeline entry?')) return;
    try {
      await axios.delete(`/api/events/${id}/timeline/${entryId}`, authHeaders);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete timeline entry');
    }
  };

  const handleTriggerReminders = async () => {
    try {
      const res = await axios.post(`/api/events/${id}/live-tasks/process-reminders`, {}, authHeaders);
      alert(`Reminder evaluation complete: ${res.data.processed_reminders_count} reminder campaign(s) triggered.`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to check reminders');
    }
  };

  const handleSaveReviewOrOverride = async () => {
    if (!reviewingSubmission) return;
    try {
      if (isOverrideMode) {
        if (!overrideReason.trim()) {
          alert('A mandatory reason is required to record an organizer override.');
          return;
        }
        await axios.post(`/api/events/${id}/submissions/${reviewingSubmission.id}/override`, {
          decision: overrideDecision,
          reason: overrideReason.trim(),
          feedback: reviewFeedback.trim() || undefined
        }, authHeaders);
      } else {
        await axios.post(`/api/events/${id}/submissions/${reviewingSubmission.id}/review`, {
          status: reviewStatus,
          organizer_feedback: reviewFeedback.trim() || undefined
        }, authHeaders);
      }

      setIsReviewModalOpen(false);
      setReviewingSubmission(null);
      setIsOverrideMode(false);
      setOverrideReason('');
      if (selectedTaskFilter !== 'all') {
        fetchSubmissions(selectedTaskFilter);
      }
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save review');
    }
  };

  const handleReverify = async (subId: number) => {
    try {
      await axios.post(`/api/events/${id}/submissions/${subId}/reverify`, {}, authHeaders);
      alert('AI Verification job dispatched! Results will refresh shortly.');
      if (selectedTaskFilter !== 'all') {
        fetchSubmissions(selectedTaskFilter);
      }
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to trigger AI verification');
    }
  };

  // Submissions filtered list and metric counts
  const filteredSubmissions = submissions.filter(s => {
    if (submissionStatusFilter === 'all') return true;
    if (submissionStatusFilter.startsWith('AI:')) {
      const target = submissionStatusFilter.replace('AI:', '');
      return s.ai_status === target;
    }
    return s.status === submissionStatusFilter;
  });

  const totalSubsCount = submissions.length;
  const aiPassedCount = submissions.filter(s => s.ai_status === 'Passed').length;
  const aiCorrectionCount = submissions.filter(s => s.ai_status === 'Needs Correction').length;
  const aiManualReviewCount = submissions.filter(s => s.ai_status === 'Needs Manual Review').length;
  const aiPendingCount = submissions.filter(s => s.ai_status === 'Pending').length;
  const verifiedCount = submissions.filter(s => s.status === 'Verified' || s.status === 'Completed').length;

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-gray-500">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="font-bold text-sm">Loading Live Event Control Center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Live Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> LIVE EVENT ACTIVE
              </span>
              <span className="text-xs text-indigo-200">
                {overview?.event_status} • {overview?.event_title}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <Radio className="w-7 h-7 text-indigo-400" />
              Live Event Control Center
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-2xl">
              Dispatch real-time announcements, generate direct task links, run AI deliverable checks, and orchestrate live deadlines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/events/${id}/live`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition"
            >
              <ExternalLink className="w-4 h-4" />
              Participant Portal &rarr;
            </Link>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-indigo-800/50">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-bold uppercase text-indigo-300 block">Registered</span>
            <span className="text-xl font-black text-white">{overview?.total_registered ?? 0}</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-bold uppercase text-emerald-300 block">Checked In</span>
            <span className="text-xl font-black text-emerald-400">{overview?.total_checked_in ?? 0}</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-bold uppercase text-purple-300 block">Teams</span>
            <span className="text-xl font-black text-purple-300">{overview?.total_teams ?? 0}</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-bold uppercase text-amber-300 block">Active Tasks</span>
            <span className="text-xl font-black text-amber-300">{overview?.active_tasks_count ?? 0}</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-bold uppercase text-sky-300 block">Submissions</span>
            <span className="text-xl font-black text-sky-300">{overview?.total_submissions_count ?? 0}</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-bold uppercase text-rose-300 block">Pending Review</span>
            <span className="text-xl font-black text-rose-400">{overview?.pending_reviews_count ?? 0}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setAnnouncementPriority('normal');
              setIsAnnouncementModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition"
          >
            <Send className="w-4 h-4 text-indigo-600" />
            1. Send Announcement
          </button>

          <button
            onClick={handleOpenNewTask}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            2. Create Task or Deadline
          </button>

          <button
            onClick={handleTriggerReminders}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 transition"
            title="Evaluate and send due task and event reminders"
          >
            <Bell className="w-4 h-4 text-amber-600" />
            3. Check & Trigger Reminders
          </button>

          <button
            onClick={() => {
              setAnnouncementPriority('urgent');
              setIsAnnouncementModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs border border-rose-200 transition"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            4. Send Urgent Update
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingTimeline(null);
              setTimelineTitle('');
              setTimelineDesc('');
              setTimelineType('activity');
              setTimelineTime(toLocalDatetimeInputValue(new Date()));
              setTimelineStatus('Scheduled');
              setIsTimelineModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition"
          >
            <Calendar className="w-4 h-4 text-gray-600" />
            + Timeline Activity
          </button>
        </div>
      </div>

      {/* Hub Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4 rounded-xl shadow-xs gap-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`py-3.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'tasks' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Active Tasks & Deadlines ({tasks.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('submissions');
            if (tasks.length > 0) fetchSubmissions(tasks[0].id);
          }}
          className={`py-3.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'submissions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Submissions & AI Reviews ({overview?.total_submissions_count ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('announcements')}
          className={`py-3.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'announcements' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Announcements Stream
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`py-3.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'timeline' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          Event Timeline ({timeline.length})
        </button>
      </div>

      {/* TAB 1: ACTIVE TASKS & DEADLINES */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
              <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900">No live tasks created yet</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Create tasks such as presentation uploads, code repo links, or checkpoint submissions to guide your attendees during the event.
              </p>
              <button
                onClick={handleOpenNewTask}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                Create First Task
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map(task => {
                const isPassed = isDateInPast(task.deadline);
                const timeRemaining = getTimeRemainingStr(task.deadline);

                return (
                  <div key={task.id} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs hover:border-indigo-300 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            task.status === 'Active' ? (isPassed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800') : 'bg-gray-100 text-gray-600'
                          }`}>
                            {task.status} {isPassed ? '• Cutoff Passed' : `• Due ${timeRemaining.label}`}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {task.submission_method.toUpperCase()}
                          </span>
                        </div>

                        {task.ai_verification_enabled && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            AI Verification Active
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-black text-gray-900 mb-1">{task.title}</h3>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-3 mb-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        {task.instructions}
                      </p>

                      {/* Checklist and Requirement Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px]">
                        {task.deliverable_checklist && task.deliverable_checklist.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                            <ListChecks className="w-3 h-3 text-slate-500" />
                            {task.deliverable_checklist.length} checklist criteria
                          </span>
                        )}
                        {task.require_url && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                            URL Required
                          </span>
                        )}
                        {task.review_required && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-semibold border border-blue-200">
                            Organizer Review Req.
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                        <div>
                          <span className="block text-[10px] font-bold uppercase text-indigo-900">Deadline</span>
                          <span className="font-semibold text-gray-900">{formatDateLocal(task.deadline)}</span>
                          <span className="block text-[10px] text-gray-500 font-mono">{task.timezone || 'UTC'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase text-indigo-900">Audience</span>
                          <span className="font-semibold capitalize text-gray-900">{task.target_audience}</span>
                        </div>
                      </div>

                      {/* Reminders Status Pill Row */}
                      {task.reminders && task.reminders.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mb-3 p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1 mr-1">
                            <Bell className="w-3 h-3 text-indigo-600" /> Reminders:
                          </span>
                          {task.reminders.map(rem => (
                            <span
                              key={rem.id}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                rem.status === 'Sent'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : rem.status === 'Scheduled'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : rem.status === 'Expired'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}
                              title={`Status: ${rem.status}${rem.failure_reason ? ` (${rem.failure_reason})` : ''}`}
                            >
                              {rem.reminder_offset_minutes > 0 ? `${rem.reminder_offset_minutes}m` : 'Now'}: {rem.status}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3">
                        <span>📥 <strong>{task.submissions_count ?? 0}</strong> submitted</span>
                        <span className="text-rose-600 font-bold">⚠️ <strong>{task.pending_reviews_count ?? 0}</strong> need review</span>
                      </div>
                    </div>

                    {/* Task Actions */}
                    <div className="pt-4 mt-3 border-t border-gray-100 space-y-2.5">
                      {/* Direct Link & Share Row */}
                      <div className="flex items-center justify-between gap-1.5 bg-gray-50 p-2 rounded-xl border border-gray-200/80 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleCopyTaskLink(task.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                            copiedTaskId === task.id
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                          title="Copy stable direct submission URL to clipboard"
                        >
                          {copiedTaskId === task.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                          {copiedTaskId === task.id ? 'Copied Link!' : 'Copy Link'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShareModalTask(task);
                            setCopiedShareUrl(false);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-gray-100 text-indigo-700 border border-indigo-200 transition"
                          title="Generate QR code and share options"
                        >
                          <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                          Share & QR
                        </button>

                        <button
                          type="button"
                          disabled={sendingReminderTaskId === task.id || task.status !== 'Active'}
                          onClick={() => handleSendReminderNow(task.id, task.title)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition disabled:opacity-50"
                          title="Immediately send a deadline reminder email to all registered attendees who have not submitted yet"
                        >
                          <Bell className="w-3.5 h-3.5 text-amber-600" />
                          {sendingReminderTaskId === task.id ? 'Sending...' : 'Remind Now'}
                        </button>

                        <Link
                          to={`/events/${id}/tasks/${task.id}/submit`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 transition"
                          title="Preview direct submission page as a participant"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                          Preview
                        </Link>
                      </div>

                      {/* Main Management Row */}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            setSelectedTaskFilter(task.id);
                            fetchSubmissions(task.id);
                            setActiveTab('submissions');
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Submissions ({task.submissions_count ?? 0})
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingTask(task);
                              setTaskForm({
                                title: task.title,
                                instructions: task.instructions,
                                description: task.description || '',
                                deadline: toLocalDatetimeInputValue(task.deadline),
                                timezone: task.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
                                target_audience: task.target_audience || 'all',
                                submission_method: task.submission_method || 'file',
                                allowed_file_types: task.allowed_file_types || '.pdf,.ppt,.pptx,.zip,.png,.jpg,.jpeg',
                                max_file_size_mb: task.max_file_size_mb || 25,
                                review_required: task.review_required ?? true,
                                ai_verification_enabled: task.ai_verification_enabled ?? true,
                                require_url: task.require_url ?? false,
                                deliverable_checklist: task.deliverable_checklist || [],
                                reminder_offsets: (task.reminders && task.reminders.length > 0)
                                  ? task.reminders.map(r => r.reminder_offset_minutes)
                                  : [30, 10]
                              });
                              setIsTaskModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
                            title="Edit Task"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                            title="Cancel Task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUBMISSIONS & REVIEWS */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          {/* Diagnostic Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Total</span>
              <span className="text-xl font-black text-gray-900">{totalSubsCount}</span>
            </div>

            <div className="bg-white rounded-xl p-3.5 border border-purple-200 shadow-2xs bg-purple-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-600" /> AI Passed
              </span>
              <span className="text-xl font-black text-purple-900">{aiPassedCount}</span>
            </div>

            <div className="bg-white rounded-xl p-3.5 border border-rose-200 shadow-2xs bg-rose-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Needs Correction</span>
              <span className="text-xl font-black text-rose-700">{aiCorrectionCount}</span>
            </div>

            <div className="bg-white rounded-xl p-3.5 border border-amber-200 shadow-2xs bg-amber-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Manual Review</span>
              <span className="text-xl font-black text-amber-700">{aiManualReviewCount}</span>
            </div>

            <div className="bg-white rounded-xl p-3.5 border border-blue-200 shadow-2xs bg-blue-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Pending AI</span>
              <span className="text-xl font-black text-blue-700">{aiPendingCount}</span>
            </div>

            <div className="bg-white rounded-xl p-3.5 border border-emerald-200 shadow-2xs bg-emerald-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Approved</span>
              <span className="text-xl font-black text-emerald-700">{verifiedCount}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            {/* Submissions Filter Toolbar */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Select Task</label>
                  <select
                    value={selectedTaskFilter}
                    onChange={(e) => {
                      const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                      setSelectedTaskFilter(val);
                      if (val !== 'all') fetchSubmissions(val);
                    }}
                    className="text-xs font-semibold bg-white border border-gray-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Active Tasks</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Status Filter</label>
                  <select
                    value={submissionStatusFilter}
                    onChange={(e) => setSubmissionStatusFilter(e.target.value)}
                    className="text-xs font-semibold bg-white border border-gray-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Submissions</option>
                    <option value="AI:Passed">AI Passed</option>
                    <option value="AI:Needs Correction">AI Needs Correction</option>
                    <option value="AI:Needs Manual Review">AI Needs Manual Review</option>
                    <option value="AI:Pending">AI Verification Pending</option>
                    <option value="Verified">Organizer Approved / Verified</option>
                    <option value="Correction Required">Correction Required</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Showing <strong>{filteredSubmissions.length}</strong> of {submissions.length} submission(s)
              </div>
            </div>

            {/* Submissions Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-100/70 text-gray-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Submitter / Team</th>
                    <th className="px-4 py-3">Submitted Work</th>
                    <th className="px-4 py-3">AI Verification</th>
                    <th className="px-4 py-3">Organizer Status</th>
                    <th className="px-4 py-3">Submitted At</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500 font-medium">
                        No submissions found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map(sub => (
                      <tr key={sub.id} className="hover:bg-gray-50/70 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{sub.submitter_name || 'Participant'}</span>
                            <button
                              type="button"
                              onClick={() => setHistoryModalSub(sub)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                              title="Click to view full revision history"
                            >
                              v{sub.version || 1}
                            </button>
                          </div>
                          <div className="text-[11px] text-gray-500">{sub.submitter_email}</div>
                          {sub.team_name && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Team: {sub.team_name}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 max-w-xs">
                          {sub.file_url && (
                            <div className="mb-1">
                              <a
                                href={sub.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                {sub.file_name || 'Download File'}
                              </a>
                              {sub.file_size_bytes && (
                                <span className="text-[10px] text-gray-400 ml-1">
                                  ({Math.round(sub.file_size_bytes / 1024)} KB)
                                </span>
                              )}
                            </div>
                          )}

                          {sub.submission_url && (
                            <div className="mb-1">
                              <a
                                href={sub.submission_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:underline truncate max-w-[200px]"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                {sub.submission_url}
                              </a>
                            </div>
                          )}

                          {sub.submission_text && (
                            <p className="text-[11px] text-gray-600 line-clamp-2 bg-gray-50 p-1.5 rounded border border-gray-100">
                              {sub.submission_text}
                            </p>
                          )}
                        </td>

                        {/* AI Verification Column */}
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.ai_status === 'Passed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              sub.ai_status === 'Needs Correction' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                              sub.ai_status === 'Needs Manual Review' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                              sub.ai_status === 'Pending' ? 'bg-blue-100 text-blue-800 animate-pulse border border-blue-200' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              <Sparkles className="w-3 h-3" />
                              {sub.ai_status || 'None'}
                            </span>

                            {sub.ai_assessment && (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setEvidenceModalSub(sub)}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline block"
                                >
                                  View Evidence & Cites &rarr;
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Organizer Status Column */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            sub.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' :
                            sub.status === 'Correction Required' ? 'bg-rose-100 text-rose-800' :
                            sub.status === 'Completed' ? 'bg-indigo-100 text-indigo-800' :
                            sub.status === 'Late' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {sub.status}
                          </span>
                          {sub.organizer_decision && (
                            <div className="text-[10px] text-gray-500 font-medium mt-0.5">
                              Decided: {sub.organizer_decision}
                            </div>
                          )}
                          {sub.is_late && <span className="block text-[9px] font-bold text-rose-600 mt-0.5">Late Submission</span>}
                        </td>

                        <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                          {new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <div className="text-[10px] text-gray-400">{new Date(sub.submitted_at).toLocaleDateString()}</div>
                        </td>

                        {/* Actions Column */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setReviewingSubmission(sub);
                                setReviewStatus((sub.status === 'Correction Required' || sub.status === 'Completed') ? sub.status : 'Verified');
                                setReviewFeedback(sub.organizer_feedback || '');
                                setIsOverrideMode(false);
                                setOverrideDecision('Approved');
                                setOverrideReason('');
                                setIsReviewModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition"
                              title="Review or override AI assessment"
                            >
                              Review / Override
                            </button>

                            <button
                              type="button"
                              onClick={() => handleReverify(sub.id)}
                              className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 border border-purple-200 transition"
                              title="Re-run AI verification"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ANNOUNCEMENTS STREAM */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Live Announcements Broadcast</h3>
              <p className="text-xs text-gray-500">All announcements are instantly displayed on participant screens and delivered through configured notification channels.</p>
            </div>
            <button
              onClick={() => {
                setAnnouncementPriority('normal');
                setIsAnnouncementModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              + New Announcement
            </button>
          </div>

          <div className="space-y-3">
            {overview?.recent_announcements.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-gray-500 text-sm border border-gray-200">
                No announcements broadcasted yet for this event.
              </div>
            ) : (
              overview?.recent_announcements.map(ann => (
                <div key={ann.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ann.priority === 'urgent' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        ann.priority === 'important' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {ann.priority.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Audience: {ann.target_audience}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-gray-900">{ann.title}</h4>
                    <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap">{ann.message}</p>
                  </div>

                  <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 text-right shrink-0">
                    <div>Sent: <strong>{ann.sent_count}</strong> / {ann.total_recipients}</div>
                    <div className="text-[10px] text-emerald-600 font-bold uppercase">{ann.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: EVENT TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Event Schedule Timeline</h3>
              <p className="text-xs text-gray-500">Provide attendees with a clear chronological timeline of ceremonies, sessions, submission cutoffs, and results announcements.</p>
            </div>
            <button
              onClick={() => {
                setEditingTimeline(null);
                setTimelineTitle('');
                setTimelineDesc('');
                setTimelineType('activity');
                setTimelineTime(toLocalDatetimeInputValue(new Date()));
                setTimelineStatus('Scheduled');
                setIsTimelineModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              + Add Timeline Activity
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
            {timeline.length === 0 ? (
              <p className="text-center text-gray-500 text-xs py-6">No timeline entries yet. Add activities like Opening Ceremony, Round 1 Kickoff, etc.</p>
            ) : (
              <div className="relative border-l-2 border-indigo-200 ml-4 space-y-6">
                {timeline.map((entry) => {
                  const tDate = new Date(entry.scheduled_time);
                  const isPast = new Date() > tDate;

                  return (
                    <div key={entry.id} className="relative pl-6">
                      <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white ${
                        isPast ? 'bg-gray-400' : 'bg-indigo-600 ring-4 ring-indigo-50'
                      }`}></div>

                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-bold text-indigo-700">
                              {tDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                              {entry.entry_type}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              entry.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {entry.status}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-gray-900">{entry.title}</h4>
                          {entry.description && <p className="text-xs text-gray-600 mt-1">{entry.description}</p>}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingTimeline(entry);
                              setTimelineTitle(entry.title);
                              setTimelineDesc(entry.description || '');
                              setTimelineType(entry.entry_type);
                              setTimelineTime(toLocalDatetimeInputValue(entry.scheduled_time));
                              setTimelineStatus(entry.status);
                              setIsTimelineModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTimeline(entry.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SHARE & QR MODAL */}
      {shareModalTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600" />
                Direct Submission Link & QR
              </h3>
              <button onClick={() => setShareModalTask(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-center">
              <div>
                <h4 className="text-sm font-black text-gray-900">{shareModalTask.title}</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Due: {new Date(shareModalTask.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(shareModalTask.deadline).toLocaleDateString()})
                </p>
              </div>

              {/* QR Code Container */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 inline-block shadow-2xs">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/events/${id}/tasks/${shareModalTask.id}/submit`)}`}
                  alt="Submission QR Code"
                  className="w-48 h-48 mx-auto rounded-lg"
                />
                <p className="text-[11px] text-gray-500 mt-2 font-medium">Scan to open on smartphone</p>
              </div>

              {/* URL Display and Copy */}
              <div className="space-y-2 text-left">
                <label className="block text-[11px] font-bold uppercase text-gray-500">Submission Page URL</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/events/${id}/tasks/${shareModalTask.id}/submit`}
                    className="w-full text-xs bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 font-mono text-gray-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/events/${id}/tasks/${shareModalTask.id}/submit`);
                      setCopiedShareUrl(true);
                      setTimeout(() => setCopiedShareUrl(false), 2500);
                    }}
                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                      copiedShareUrl ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {copiedShareUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedShareUrl ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`${window.location.origin}/events/${id}/tasks/${shareModalTask.id}/submit`)}`}
                  download={`submission_qr_task_${shareModalTask.id}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition"
                >
                  <Download className="w-3.5 h-3.5 text-gray-600" />
                  Download QR
                </a>

                <Link
                  to={`/events/${id}/tasks/${shareModalTask.id}/submit`}
                  target="_blank"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Page &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI EVIDENCE INSPECTOR MODAL */}
      {evidenceModalSub && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-black text-gray-900">
                  AI Assessment & Evidence Citations
                </h3>
              </div>
              <button onClick={() => setEvidenceModalSub(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Header Box */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-900 text-sm">
                    {evidenceModalSub.submitter_name} {evidenceModalSub.team_name ? `• Team ${evidenceModalSub.team_name}` : ''}
                  </div>
                  <div className="text-gray-500 text-[11px] mt-0.5">
                    Version v{evidenceModalSub.version} • Submitted {new Date(evidenceModalSub.submitted_at).toLocaleString()}
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-black ${
                  evidenceModalSub.ai_status === 'Passed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                  evidenceModalSub.ai_status === 'Needs Correction' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                  evidenceModalSub.ai_status === 'Needs Manual Review' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  AI: {evidenceModalSub.ai_status}
                </span>
              </div>

              {/* Assessment Summary */}
              {evidenceModalSub.ai_assessment?.summary && (
                <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                  <span className="block font-bold text-purple-950 mb-1">AI Findings Summary</span>
                  <p className="text-purple-900 leading-relaxed">{evidenceModalSub.ai_assessment.summary}</p>
                </div>
              )}

              {/* Checklist Results Table */}
              {evidenceModalSub.ai_assessment?.checklist_results && (
                <div>
                  <span className="block font-bold text-gray-800 mb-2">Checklist Verification Breakdown</span>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {evidenceModalSub.ai_assessment.checklist_results.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-gray-900">{item.criteria}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            item.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' :
                            item.status === 'FAIL' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {item.status}
                          </span>
                        </div>

                        {item.evidence_quote_or_citation && (
                          <div className="p-2 bg-gray-50 rounded-lg border border-gray-100 text-[11px] text-gray-700 italic">
                            &ldquo;{item.evidence_quote_or_citation}&rdquo;
                          </div>
                        )}

                        {item.missing_reason && (
                          <div className="text-[11px] text-rose-700 font-medium">
                            Missing requirement: {item.missing_reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Corrections */}
              {evidenceModalSub.ai_assessment?.suggested_corrections && evidenceModalSub.ai_assessment.suggested_corrections.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="block font-bold text-amber-900 mb-1">Suggested Corrections</span>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-[11px]">
                    {evidenceModalSub.ai_assessment.suggested_corrections.map((corr: string, idx: number) => (
                      <li key={idx}>{corr}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    handleReverify(evidenceModalSub.id);
                    setEvidenceModalSub(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Re-run Verification
                </button>

                <button
                  type="button"
                  onClick={() => setEvidenceModalSub(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VERSION HISTORY MODAL */}
      {historyModalSub && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                Submission Revision History
              </h3>
              <button onClick={() => setHistoryModalSub(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-96 overflow-y-auto pr-1">
              <div className="text-gray-600 mb-2 font-medium">
                Showing all versions for <strong>{historyModalSub.submitter_name}</strong>
              </div>

              {(!historyModalSub.versions || historyModalSub.versions.length === 0) ? (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center text-gray-500">
                  Current version is <strong>v{historyModalSub.version || 1}</strong>. No earlier revisions recorded.
                </div>
              ) : (
                historyModalSub.versions.map((ver) => (
                  <div key={ver.id} className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-700">Version {ver.version_number}</span>
                      <span className="text-[10px] text-gray-400">{new Date(ver.submitted_at).toLocaleString()}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
                      {ver.file_name && (
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                          <FileText className="w-3.5 h-3.5" /> {ver.file_name}
                        </span>
                      )}
                      {ver.submission_url && (
                        <span className="inline-flex items-center gap-1 font-semibold text-sky-600">
                          <ExternalLink className="w-3.5 h-3.5" /> {ver.submission_url}
                        </span>
                      )}
                    </div>

                    {ver.ai_status && (
                      <div className="text-[10px]">
                        AI Assessment: <strong>{ver.ai_status}</strong>
                      </div>
                    )}

                    {ver.organizer_feedback && (
                      <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-100">
                        Feedback: {ver.organizer_feedback}
                      </div>
                    )}
                  </div>
                ))
              )}

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setHistoryModalSub(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT TASK MODAL */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
              <h3 className="text-lg font-black text-gray-900">
                {editingTask ? 'Edit Task or Deadline' : 'Create Task or Deadline'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAIModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Polish Notes
                </button>
                <button onClick={() => setIsTaskModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Upload Presentation Deck (PPT), Submit GitHub Repository"
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Instructions for Participants *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Upload your slides in PDF or PPT format before the cutoff. Each team needs only one submission."
                  value={taskForm.instructions}
                  onChange={e => setTaskForm({ ...taskForm, instructions: e.target.value })}
                  className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700">Deadline Date & Time *</label>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {taskForm.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </span>
                  </div>
                  <input
                    type="datetime-local"
                    required
                    value={taskForm.deadline}
                    onChange={e => setTaskForm({ ...taskForm, deadline: e.target.value })}
                    className={`w-full text-xs sm:text-sm border rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition ${
                      isDateInPast(taskForm.deadline)
                        ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-rose-500'
                        : 'border-gray-300'
                    }`}
                  />
                  <div className="mt-1 text-[11px]">
                    {isDateInPast(taskForm.deadline) ? (
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Deadline is in the past! Reminders will not trigger. Pick a future time.
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Due {getTimeRemainingStr(taskForm.deadline).label} ({formatDateLocal(taskForm.deadline)})
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Target Audience</label>
                  <select
                    value={taskForm.target_audience}
                    onChange={e => setTaskForm({ ...taskForm, target_audience: e.target.value })}
                    className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="all">All Eligible Attendees</option>
                    <option value="teams">Teams Only</option>
                    <option value="participants">Individual Registrations</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Submission Method</label>
                  <select
                    value={taskForm.submission_method}
                    onChange={e => setTaskForm({ ...taskForm, submission_method: e.target.value })}
                    className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="file">File Upload Only</option>
                    <option value="url">Link / URL Only</option>
                    <option value="text">Text Response</option>
                    <option value="file_url">File or URL</option>
                    <option value="all">Any Combination (File, URL, Text)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Allowed File Types</label>
                  <input
                    type="text"
                    value={taskForm.allowed_file_types}
                    onChange={e => setTaskForm({ ...taskForm, allowed_file_types: e.target.value })}
                    placeholder=".pdf,.ppt,.pptx,.zip"
                    className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Checklist Criteria Builder */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Deliverable Checklist Criteria
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">Used for AI Verification</span>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newChecklistInput}
                    onChange={e => setNewChecklistInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newChecklistInput.trim()) {
                          setTaskForm({ ...taskForm, deliverable_checklist: [...taskForm.deliverable_checklist, newChecklistInput.trim()] });
                          setNewChecklistInput('');
                        }
                      }
                    }}
                    placeholder="e.g. Include architecture diagram"
                    className="flex-1 text-xs border border-gray-300 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newChecklistInput.trim()) {
                        setTaskForm({ ...taskForm, deliverable_checklist: [...taskForm.deliverable_checklist, newChecklistInput.trim()] });
                        setNewChecklistInput('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-900"
                  >
                    Add
                  </button>
                </div>

                {taskForm.deliverable_checklist.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {taskForm.deliverable_checklist.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {item}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTaskForm({
                            ...taskForm,
                            deliverable_checklist: taskForm.deliverable_checklist.filter((_, i) => i !== idx)
                          })}
                          className="text-gray-400 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Toggles */}
              <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={taskForm.ai_verification_enabled}
                    onChange={e => setTaskForm({ ...taskForm, ai_verification_enabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span>Enable Automatic AI Verification (Analyzes submissions against criteria)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={taskForm.require_url}
                    onChange={e => setTaskForm({ ...taskForm, require_url: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span>Require Project / Repository URL</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={taskForm.review_required}
                    onChange={e => setTaskForm({ ...taskForm, review_required: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span>Organizer Review & Approval Required</span>
                </label>
              </div>

              {/* Reminders Schedule */}
              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                <span className="block text-xs font-bold text-indigo-950 mb-1.5">Smart Automated Reminders</span>
                <p className="text-[11px] text-indigo-800 mb-2">
                  Emails are automatically sent to unsubmitted registered participants before the deadline:
                </p>
                <div className="flex flex-wrap gap-2 text-xs mb-2">
                  {[
                    { label: '30 mins before', val: 30 },
                    { label: '15 mins before', val: 15 },
                    { label: '10 mins before', val: 10 },
                    { label: '5 mins before', val: 5 },
                    { label: '60 mins before', val: 60 },
                    { label: '24 hours before', val: 1440 }
                  ].map(item => {
                    const active = taskForm.reminder_offsets.includes(item.val);
                    return (
                      <button
                        type="button"
                        key={item.val}
                        onClick={() => {
                          if (active) {
                            setTaskForm({ ...taskForm, reminder_offsets: taskForm.reminder_offsets.filter(v => v !== item.val) });
                          } else {
                            setTaskForm({ ...taskForm, reminder_offsets: [...taskForm.reminder_offsets, item.val] });
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition ${
                          active ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                {taskForm.reminder_offsets.length === 0 && (
                  <p className="text-[11px] text-amber-700 font-semibold">
                    ⚠️ No automated reminders selected. You can still send manual reminders at any time with "Remind Now".
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs"
                >
                  {editingTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI POLISH ASSISTANT MODAL */}
      {isAIModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-purple-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
              <h3 className="text-base font-black text-purple-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                AI-Assisted Task Instructions
              </h3>
              <button onClick={() => setIsAIModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-3">
              Type or paste rough organizer notes. AI will structure them into clear step-by-step instructions without inventing dates or venues.
            </p>

            <textarea
              rows={4}
              value={aiRawInput}
              onChange={e => setAiRawInput(e.target.value)}
              placeholder="e.g. Everyone submit ppt by 5, teams come hall A after submission, only team leader needs to upload."
              className="w-full text-xs sm:text-sm border border-purple-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4 bg-purple-50/20"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAIModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAIPolish}
                disabled={aiLoading || !aiRawInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiLoading ? 'Structuring...' : 'Generate Formatted Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ANNOUNCEMENT BROADCAST MODAL */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                {announcementPriority === 'urgent' ? (
                  <span className="text-rose-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-5 h-5" /> Send Urgent Alert
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Send className="w-5 h-5 text-indigo-600" /> Broadcast Announcement
                  </span>
                )}
              </h3>
              <button onClick={() => setIsAnnouncementModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Priority Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'important', 'urgent'] as const).map(p => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setAnnouncementPriority(p)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                        announcementPriority === p
                          ? (p === 'urgent' ? 'bg-rose-600 text-white border-rose-600' : p === 'important' ? 'bg-amber-600 text-white border-amber-600' : 'bg-indigo-600 text-white border-indigo-600')
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Announcement Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Presentation Session Commencing, Auditorium Entry Rules"
                  value={announcementTitle}
                  onChange={e => setAnnouncementTitle(e.target.value)}
                  className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Message Body *</label>
                <textarea
                  rows={4}
                  placeholder="e.g. All teams must report to Main Auditorium Hall A immediately with their presentation files."
                  value={announcementMsg}
                  onChange={e => setAnnouncementMsg(e.target.value)}
                  className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Target Audience</label>
                <select
                  value={announcementAudience}
                  onChange={e => setAnnouncementAudience(e.target.value as any)}
                  className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="all">All Registered Attendees</option>
                  <option value="teams">Registered Teams Only</option>
                </select>
              </div>

              {urgentConfirmOpen && (
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs text-rose-800 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Please Confirm Urgent Broadcast:
                  </p>
                  <p>
                    Urgent announcements highlight prominently across all attendee screens and bypass notification marketing mutes.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAnnouncementModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendAnnouncement}
                  className={`px-5 py-2 rounded-xl text-xs font-black text-white ${
                    announcementPriority === 'urgent' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {announcementPriority === 'urgent' ? (urgentConfirmOpen ? 'Confirm & Send Urgent Alert' : 'Review & Send') : 'Send Announcement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW & OVERRIDE SUBMISSION MODAL */}
      {isReviewModalOpen && reviewingSubmission && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
              <h3 className="text-base font-black text-gray-900">
                {isOverrideMode ? 'Override AI Assessment' : 'Review Submission'}
              </h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-900">{reviewingSubmission.submitter_name} ({reviewingSubmission.submitter_email})</div>
                  {reviewingSubmission.team_name && <div className="text-indigo-600 font-semibold">Team: {reviewingSubmission.team_name}</div>}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    AI: {reviewingSubmission.ai_status || 'None'}
                  </span>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex border border-gray-200 rounded-xl p-1 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setIsOverrideMode(false)}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-center transition ${
                    !isOverrideMode ? 'bg-white shadow-2xs text-indigo-700' : 'text-gray-600'
                  }`}
                >
                  Standard Review
                </button>
                <button
                  type="button"
                  onClick={() => setIsOverrideMode(true)}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-center transition ${
                    isOverrideMode ? 'bg-purple-600 text-white shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  Override AI Assessment
                </button>
              </div>

              {!isOverrideMode ? (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Set Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Verified', 'Correction Required', 'Completed'] as const).map(st => (
                      <button
                        type="button"
                        key={st}
                        onClick={() => setReviewStatus(st)}
                        className={`py-2 px-2 rounded-xl font-bold border transition text-center ${
                          reviewStatus === st
                            ? (st === 'Verified' ? 'bg-emerald-600 text-white border-emerald-600' : st === 'Correction Required' ? 'bg-rose-600 text-white border-rose-600' : 'bg-indigo-600 text-white border-indigo-600')
                            : 'bg-white text-gray-700 border-gray-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-purple-900 mb-1">Override Decision *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Approved', 'Correction Required', 'Reopened'] as const).map(dec => (
                        <button
                          type="button"
                          key={dec}
                          onClick={() => setOverrideDecision(dec)}
                          className={`py-2 px-2 rounded-xl font-bold border transition text-center ${
                            overrideDecision === dec
                              ? (dec === 'Approved' ? 'bg-emerald-600 text-white border-emerald-600' : dec === 'Correction Required' ? 'bg-rose-600 text-white border-rose-600' : 'bg-indigo-600 text-white border-indigo-600')
                              : 'bg-white text-gray-700 border-gray-200'
                          }`}
                        >
                          {dec}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Reason for Override * <span className="text-rose-500">(Mandatory for audit trail)</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                      placeholder="e.g. Visual inspection confirms diagram is present in appendix"
                      className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Organizer Feedback Note
                  {(reviewStatus === 'Correction Required' || overrideDecision === 'Correction Required') && (
                    <span className="text-rose-500"> (Required for corrections)</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={reviewFeedback}
                  onChange={e => setReviewFeedback(e.target.value)}
                  placeholder="Optional guidance or corrections required for participant"
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReviewOrOverride}
                  className={`px-5 py-2 rounded-xl text-xs font-black text-white ${
                    isOverrideMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isOverrideMode ? 'Record Override' : 'Save Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TIMELINE MODAL */}
      {isTimelineModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
              <h3 className="text-base font-black text-gray-900">
                {editingTimeline ? 'Edit Timeline Entry' : 'Add Timeline Activity'}
              </h3>
              <button onClick={() => setIsTimelineModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTimeline} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Activity Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Round 1 Pitching, Lunch Break, Award Ceremony"
                  value={timelineTitle}
                  onChange={e => setTimelineTitle(e.target.value)}
                  className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Main Auditorium Hall B"
                  value={timelineDesc}
                  onChange={e => setTimelineDesc(e.target.value)}
                  className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Scheduled Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={timelineTime}
                    onChange={e => setTimelineTime(e.target.value)}
                    className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Type</label>
                  <select
                    value={timelineType}
                    onChange={e => setTimelineType(e.target.value)}
                    className="w-full text-xs sm:text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="activity">General Activity</option>
                    <option value="deadline">Task Deadline</option>
                    <option value="submission_window">Submission Window</option>
                    <option value="results">Results Announcement</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsTimelineModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
