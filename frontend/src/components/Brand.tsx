import { Link } from 'react-router-dom';

export function BrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill="url(#brandGrad)" />
      <path d="M160 160 h192 v48 h-144 v48 h112 v48 h-112 v48 h144 v48 h-192 z" fill="#ffffff" />
    </svg>
  );
}

export function Logo({ withTagline = false, className = "" }: { withTagline?: boolean, className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <BrandIcon className="w-8 h-8 mr-3 shadow-sm rounded-lg" />
      <div className="flex flex-col">
        <span className="text-xl font-extrabold tracking-tight text-navy" style={{ letterSpacing: '-0.02em', color: 'var(--color-navy)' }}>
          EVENTIVA
        </span>
        {withTagline && (
          <span className="text-xs text-gray-500 font-medium">Every Event. One Platform.</span>
        )}
      </div>
    </div>
  );
}

export function PoweredByFooter() {
  return (
    <div className="mt-16 pt-8 pb-12 flex flex-col items-center justify-center border-t border-gray-200">
      <Link to="/" className="flex items-center text-gray-400 hover:text-gray-600 transition-colors">
        <BrandIcon className="w-5 h-5 mr-2 grayscale opacity-75" />
        <span className="text-sm font-medium">Powered by EVENTIVA - Every Event. One Platform.</span>
      </Link>
    </div>
  );
}
