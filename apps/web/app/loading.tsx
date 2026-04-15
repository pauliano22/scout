export default function Loading() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg-primary]">
        <div className="flex flex-col items-center gap-4">
          {/* Logo */}
          <img 
            src="/favicon.svg" 
            alt="Scout" 
            className="w-12 h-12 animate-pulse" 
          />
          
          {/* Spinner */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[--school-primary] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-[--school-primary] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-[--school-primary] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          
          {/* Optional text */}
          <p className="text-[--text-quaternary] text-sm">Loading...</p>
        </div>
      </div>
    )
  }