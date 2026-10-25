import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Share2 } from 'lucide-react';
import ShareRegistrationModal from '../components/ShareRegistrationModal';

export default function MyEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedShareEvent, setSelectedShareEvent] = useState<any | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/events/my', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEvents(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchEvents();
  }, []);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">My Events</h2>
          <p className="text-xs sm:text-sm text-gray-500">Manage and design your created events</p>
        </div>
        <Link to="/dashboard/events/new" className="inline-flex items-center justify-center bg-[var(--color-primary)] border border-transparent rounded-xl shadow-xs py-2.5 px-4 text-xs sm:text-sm font-bold text-white hover:bg-[var(--color-primary-hover)] transition">
          + Create Event
        </Link>
      </div>
      <div className="bg-white shadow-xs rounded-2xl overflow-hidden border border-gray-200">
        <ul className="divide-y divide-gray-100">
          {events.length === 0 ? (
            <li className="p-8 text-center text-gray-500">
              <p className="font-semibold text-sm">No events found.</p>
              <Link to="/dashboard/events/new" className="mt-2 inline-block text-xs font-bold text-indigo-600 hover:underline">Create your first event</Link>
            </li>
          ) : (
            events.map((event) => (
              <li key={event.id} className="p-4 sm:p-6 hover:bg-gray-50/70 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full ${event.status === 'Published' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                        {event.status}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">{event.category || 'Event'}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">{event.title}</h3>
                    <p className="mt-0.5 text-xs text-gray-500">📍 {event.venue || 'Venue TBA'}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    <Link to={`/dashboard/events/${event.id}/live`} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition flex items-center gap-1">
                      <span>⚡</span><span>Live Hub</span>
                    </Link>
                    {event.status === 'Published' && (
                      <>
                        <Link to={`/events/${event.id}`} target="_blank" className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition">
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => setSelectedShareEvent(event)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition flex items-center gap-1"
                          title="Share Registration Form"
                        >
                          <Share2 className="w-3 h-3 text-emerald-600" />
                          <span>Share Form</span>
                        </button>
                      </>
                    )}
                    <Link to={`/dashboard/events/${event.id}/poster`} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition flex items-center gap-1">
                      <span>🎨</span><span>Poster</span>
                    </Link>
                    <Link to={`/dashboard/events/${event.id}/participants`} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition">
                      Participants
                    </Link>
                    <Link to={`/dashboard/events/${event.id}/notifications`} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition flex items-center gap-1">
                      <span>📢</span><span>Broadcast</span>
                    </Link>
                    <Link to={`/dashboard/events/${event.id}/edit`} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition">
                      Edit
                    </Link>
                    <button onClick={async () => {
                      if(window.confirm('Are you sure you want to delete this event?')) {
                        try {
                          const token = localStorage.getItem('token');
                          await axios.delete(`/api/events/${event.id}`, { headers: { Authorization: `Bearer ${token}` } });
                          setEvents(events.filter(e => e.id !== event.id));
                        } catch (err) { alert('Failed to delete event'); }
                      }
                    }} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition">
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <ShareRegistrationModal
        isOpen={!!selectedShareEvent}
        onClose={() => setSelectedShareEvent(null)}
        event={selectedShareEvent}
      />
    </div>
  );
}
