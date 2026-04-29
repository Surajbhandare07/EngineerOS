export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="w-8 h-8 border-4 border-purple-600 dark:border-purple-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
}
