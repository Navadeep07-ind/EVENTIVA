import { useEffect, useState } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { LayoutDashboard, Calendar, PlusCircle, LogOut, Image as ImageIcon, Menu, X } from 'lucide-react';
import MyEvents from './MyEvents';
import EventCreate from './EventCreate';
import EventEdit from './EventEdit';
import ParticipantsList from './ParticipantsList';
import NotificationsHub from './NotificationsHub';
import LiveControlCenter from './LiveControlCenter';
import PosterGenerator from './PosterGenerator';
import { Logo } from '../components/Brand';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<{full_name: string} | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    axios.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setUser(res.data);
    }).catch(() => {
      localStorage.removeItem('token');
      navigate('/login');
    });
  }, [navigate]);

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const isActive = (path: string) => location.pathname === path || location.pathname === path + '/';

  const navLinks = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/dashboard/events', label: 'My Events', icon: Calendar },
    { to: '/dashboard/events/new', label: 'Create Event', icon: PlusCircle },
    { to: '/dashboard/poster-generator', label: 'Poster Studio', icon: ImageIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <Link to="/dashboard"><Logo /></Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full truncate max-w-[130px]">
            {user.full_name}
          </span>
          <button 
            onClick={() => { localStorage.removeItem('token'); navigate('/login'); }} 
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-xs transition-opacity" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop Persistent / Mobile Slide-Over) */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:w-64 md:z-auto
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}><Logo /></Link>
          <button 
            onClick={() => setMobileMenuOpen(false)} 
            className="md:hidden p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1.5 px-3">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link 
                  key={link.to}
                  to={link.to} 
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center px-3.5 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                    active 
                      ? 'bg-[var(--color-primary)] text-white shadow-xs' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-[var(--color-primary)]'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 ${active ? 'text-white' : 'text-gray-400'}`} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-2 truncate">Signed in as <span className="font-bold text-gray-800">{user.full_name}</span></div>
          <button onClick={() => { localStorage.removeItem('token'); navigate('/login'); }} className="flex items-center w-full px-3 py-2 text-sm font-semibold rounded-lg text-red-700 hover:bg-red-50 transition">
            <LogOut className="mr-3 h-5 w-5 text-red-500" />
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="hidden md:flex h-16 bg-white border-b border-gray-200 items-center px-6 justify-between shrink-0">
          <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-600 mr-4">Welcome, <strong className="text-gray-900">{user.full_name}</strong></span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 pb-24 md:pb-6">
          <Routes>
            <Route path="/" element={
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-gray-100">
                  <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Welcome back</h3>
                  <p className="mt-2 text-lg sm:text-xl font-black text-gray-900 leading-tight">Ready to launch or design your next event?</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to="/dashboard/poster-generator" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition shadow-xs">
                      🎨 Open Poster Studio
                    </Link>
                    <Link to="/dashboard/events/new" className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-3 py-2 rounded-lg transition">
                      ➕ Create Event
                    </Link>
                  </div>
                </div>
              </div>
            } />
            <Route path="/events" element={<MyEvents />} />
            <Route path="/events/new" element={<EventCreate />} />
            <Route path="/events/:id/edit" element={<EventEdit />} />
            <Route path="/events/:id/participants" element={<ParticipantsList />} />
            <Route path="/events/:id/notifications" element={<NotificationsHub />} />
            <Route path="/events/:id/live" element={<LiveControlCenter />} />
            <Route path="/events/:id/poster" element={<PosterGenerator />} />
            <Route path="/poster-generator" element={<PosterGenerator />} />
            <Route path="/generator" element={<PosterGenerator />} />
            <Route path="/generator/:id" element={<PosterGenerator />} />
          </Routes>
        </main>
      </div>

      {/* Mobile Persistent Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex justify-around items-center py-2 px-1 z-30 shadow-lg">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.to);
          return (
            <Link 
              key={link.to}
              to={link.to} 
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-bold transition ${
                active ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />
              <span>{link.label === 'Create Event' ? 'Create' : link.label === 'Poster Studio' ? 'Studio' : link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
