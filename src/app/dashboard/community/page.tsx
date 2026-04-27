'use client'

import { useState, useEffect } from 'react'
import { getPosts, createPost, toggleUpvote, toggleDownvote, addReply, getReplies, getMentorPoints } from '@/lib/actions/community'
import Spinner from '@/components/ui/Spinner'

/* ───── Inline SVG Icons (no external deps) ───── */
function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function ThumbsUpIcon({ filled = false, className = '' }: { filled?: boolean; className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  )
}

function ThumbsDownIcon({ filled = false, className = '' }: { filled?: boolean; className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  )
}

function MessageIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}

function ShareIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  )
}

function UserIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  )
}

function SparkleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  )
}

function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  )
}

function XIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

function TrendingIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

/* ───── Time Ago Helper ───── */
function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/* ───── Avatar Gradient Helper ───── */
const avatarGradients = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-500',
  'from-indigo-500 to-blue-500',
]
function getAvatarGradient(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarGradients[Math.abs(hash) % avatarGradients.length]
}

/* ───── Year badge colors ───── */
/* ───── Year badge colors ───── */
const yearColors: Record<string, string> = {
  FE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  SE: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  TE: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  BE: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
}

/* ═════════════════════════════════════════════
   POST CARD COMPONENT
   ═════════════════════════════════════════════ */
function PostCard({ post, initialIsUpvoted, initialIsDownvoted, refreshFeed }: { post: any, initialIsUpvoted: boolean, initialIsDownvoted: boolean, refreshFeed: () => void }) {
  const [isUpvoted, setIsUpvoted] = useState(initialIsUpvoted)
  const [isDownvoted, setIsDownvoted] = useState(initialIsDownvoted)
  const [upvotes, setUpvotes] = useState(post.upvotes || 0)
  const [downvotes, setDownvotes] = useState(post.downvotes || 0)
  
  const [showReplies, setShowReplies] = useState(false)
  const [replies, setReplies] = useState<any[]>([])
  const [replyContent, setReplyContent] = useState('')
  const [replyYear, setReplyYear] = useState('FE')
  const [replying, setReplying] = useState(false)
  
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleUpvoteClick = async () => {
    setIsUpvoted(!isUpvoted)
    setUpvotes(isUpvoted ? Math.max(0, upvotes - 1) : upvotes + 1)
    if (!isUpvoted && isDownvoted) {
      setIsDownvoted(false)
      setDownvotes(Math.max(0, downvotes - 1))
    }
    
    const res = await toggleUpvote(post.id)
    if (res.success) {
      setUpvotes(res.upvotes)
      setDownvotes(res.downvotes)
    } else {
      showToast("Failed to sync upvote")
      refreshFeed()
    }
  }

  const handleDownvoteClick = async () => {
    setIsDownvoted(!isDownvoted)
    setDownvotes(isDownvoted ? Math.max(0, downvotes - 1) : downvotes + 1)
    if (!isDownvoted && isUpvoted) {
      setIsUpvoted(false)
      setUpvotes(Math.max(0, upvotes - 1))
    }
    
    const res = await toggleDownvote(post.id)
    if (res.success) {
      setUpvotes(res.upvotes)
      setDownvotes(res.downvotes)
    } else {
      showToast("Failed to sync downvote")
      refreshFeed()
    }
  }

  const handleShare = () => {
    const link = `${window.location.origin}/dashboard/community?post=${post.id}`
    navigator.clipboard.writeText(link)
    showToast("Link copied to clipboard!")
  }

  const fetchPostReplies = async () => {
    const res = await getReplies(post.id)
    if (res.success) setReplies(res.data || [])
  }

  const toggleReplies = () => {
    if (!showReplies) fetchPostReplies()
    setShowReplies(!showReplies)
  }

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyContent.trim()) return
    setReplying(true)
    const res = await addReply(post.id, replyContent, post.academic_year, replyYear)
    if (res.success) {
       setReplyContent('')
       fetchPostReplies()
       refreshFeed()
       showToast("Reply posted successfully!")
    } else {
       showToast(res.error || "Failed to post reply")
    }
    setReplying(false)
  }

  const gradient = getAvatarGradient(post.anonymous_name)
  const yrClass = yearColors[post.academic_year] || 'bg-muted text-muted-foreground border-border'

  return (
    <article className="relative bg-card border border-border rounded-[2rem] p-6 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/20 hover:border-purple-500/30 transition-all duration-300">
      
      {toastMessage && (
        <div className="absolute top-4 right-4 bg-foreground text-background text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl shadow-2xl z-10 animate-in">
          {toastMessage}
        </div>
      )}

      <div className="flex items-start gap-4 mb-4">
        <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-lg font-black shrink-0 shadow-lg`}>
          {post.anonymous_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[16px] text-foreground tracking-tight">{post.anonymous_name}</span>
            <span className="text-muted-foreground/30 text-xs">•</span>
            <span className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">{timeAgo(post.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${yrClass}`}>
              {post.academic_year}
            </span>
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border/50 uppercase tracking-widest">
              {post.department}
            </span>
          </div>
        </div>
      </div>

      <p className="text-[15px] text-foreground/80 leading-relaxed whitespace-pre-wrap pl-[64px] font-medium">
        {post.content}
      </p>

      <div className="flex items-center gap-2 mt-6 pl-[64px]">
        
        <div className="flex items-center bg-muted/50 rounded-full border border-border p-1 mr-2">
          <button
            onClick={handleUpvoteClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-200 ${
              isUpvoted
                ? 'text-purple-600 bg-purple-500/10'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <ThumbsUpIcon filled={isUpvoted} className={isUpvoted ? 'text-purple-600' : 'text-muted-foreground'} />
            <span>{upvotes}</span>
          </button>
          
          <div className="w-[1px] h-4 bg-border mx-1"></div>
          
          <button
            onClick={handleDownvoteClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-200 ${
              isDownvoted
                ? 'text-red-600 bg-red-500/10'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <ThumbsDownIcon filled={isDownvoted} className={isDownvoted ? 'text-red-600' : 'text-muted-foreground'} />
            <span>{downvotes > 0 ? downvotes : ''}</span>
          </button>
        </div>

        <button 
          onClick={toggleReplies}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-200 ${
            showReplies ? 'bg-foreground text-background shadow-lg' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <MessageIcon />
          <span>Reply {replies.length > 0 && `(${replies.length})`}</span>
        </button>

        <button 
          onClick={handleShare}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
        >
          <ShareIcon />
          <span>Share</span>
        </button>
      </div>

      {showReplies && (
        <div className="mt-6 pl-[64px] border-t border-border/50 pt-6 space-y-5">
          
          {replies.length > 0 ? (
            <div className="space-y-4">
              {replies.map(r => {
                const repGrad = getAvatarGradient(r.anonymous_name);
                return (
                  <div key={r.id} className="flex gap-4 animate-in">
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${repGrad} flex items-center justify-center text-white text-sm font-black shrink-0 shadow-md`}>
                      {r.anonymous_name.charAt(0)}
                    </div>
                    <div className="bg-muted/30 rounded-[1.5rem] rounded-tl-none p-4 flex-1 border border-border/50 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-[13px] text-foreground tracking-tight">{r.anonymous_name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{timeAgo(r.created_at)}</span>
                      </div>
                      <p className="text-[13px] text-foreground/80 leading-relaxed font-medium">{r.content}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.2em] py-4 bg-muted/20 rounded-2xl text-center border border-dashed border-border">No contributions yet. Be the first!</div>
          )}

          <form onSubmit={handleReplySubmit} className="flex gap-3 items-center pt-2">
            <select 
              value={replyYear} 
              onChange={e => setReplyYear(e.target.value)} 
              className="bg-card border border-border text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="FE">FE</option><option value="SE">SE</option><option value="TE">TE</option><option value="BE">BE</option>
            </select>
            <input
              type="text"
              value={replyContent}
              onChange={e => setReplyContent(e.target.value)}
              placeholder="Add your insight..."
              className="flex-1 bg-muted/50 border border-border rounded-xl px-5 py-3 text-[13px] font-medium text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
              disabled={replying}
            />
            <button 
              type="submit" 
              disabled={replying || !replyContent.trim()} 
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20 active:scale-95"
            >
              {replying ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Post'}
            </button>
          </form>
        </div>
      )}
    </article>
  )
}

/* ═════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════ */
export default function CommunityPage() {
  const [posts, setPosts] = useState<any[]>([])
  const [userUpvotedIds, setUserUpvotedIds] = useState<string[]>([])
  const [userDownvotedIds, setUserDownvotedIds] = useState<string[]>([])
  const [mentorPoints, setMentorPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [content, setContent] = useState('')
  const [year, setYear] = useState('FE')
  const [dept, setDept] = useState('Computer Science')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const years = ['ALL', 'FE', 'SE', 'TE', 'BE']
  const departments = [
    'Computer Science', 'Information Technology', 'Mechanical',
    'Civil', 'Electronics', 'Electrical',
  ]

  useEffect(() => { fetchPosts() }, [filter])

  const fetchPosts = async () => {
    setLoading(true)
    const res = await getPosts(filter)
    if (res.success) {
      setPosts(res.data || [])
      setUserUpvotedIds(res.userUpvotedIds || [])
      setUserDownvotedIds(res.userDownvotedIds || [])
    }
    const pointsRes = await getMentorPoints()
    if (pointsRes.success) {
      setMentorPoints(pointsRes.data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    setError(null)
    const res = await createPost({ content, academic_year: year, department: dept })
    if (res.success) {
      setContent('')
      setIsModalOpen(false)
      fetchPosts()
    } else {
      setError(res.error || 'Failed to post')
    }
    setSubmitting(false)
  }

  const filteredPosts = searchQuery.trim()
    ? posts.filter(p => p.content.toLowerCase().includes(searchQuery.toLowerCase()) || p.anonymous_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : posts

  return (
    <div className="max-w-6xl mx-auto pb-20">

      {/* ─── Page Header ─── */}
      <div className="mb-10">
        <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase italic">Engineering Square</h1>
        <p className="text-muted-foreground mt-2 text-[15px] font-medium leading-relaxed max-w-xl">
          The sanctuary for engineering minds. Ask anonymously, mentor peers, and cultivate professional excellence together.
        </p>
      </div>

      {/* ─── 2-Column Grid ─── */}
      <div className="flex flex-col lg:flex-row gap-10">

        {/* ═══ LEFT: Feed Column ═══ */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* ── Search Bar ── */}
          <div className="relative group">
            <div className="absolute inset-0 bg-purple-600/5 blur-3xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-purple-600 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Query doubts, topics, or engineering concepts…"
              className="w-full pl-14 pr-6 py-5 bg-card border border-border rounded-full text-[15px] font-medium text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-sm"
            />
          </div>

          {/* ── Create Post Prompt ── */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center gap-4 px-6 py-5 bg-card border border-border rounded-[2rem] text-muted-foreground hover:border-purple-500/30 hover:bg-muted/30 transition-all group shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform">
              <UserIcon className="text-white w-5 h-5" />
            </div>
            <span className="text-[15px] font-semibold group-hover:text-foreground transition-colors italic">What architectural doubt is on your mind?</span>
            <div className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-purple-600/20 active:scale-95">
              <PlusIcon className="w-4 h-4" />
              Initiate
            </div>
          </button>

          {/* ── Filter Chips ── */}
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setFilter(y)}
                className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all duration-300 border ${
                  filter === y
                    ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/20'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                }`}
              >
                {y === 'ALL' ? '🔥 Spotlight' : y}
              </button>
            ))}
          </div>

          {/* ── Feed Content ── */}
          {loading ? (
            <div className="flex justify-center py-32">
              <Spinner />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="bg-card border-2 border-dashed border-border rounded-[3rem] py-32 px-10 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-muted shadow-inner">
                <MessageIcon className="text-muted-foreground/30 w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-foreground tracking-tight uppercase">Void Detected</h3>
                <p className="text-muted-foreground text-sm font-medium max-w-xs mx-auto">Be the pioneer. Initiate the first technical discussion in this quadrant.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredPosts.map(post => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  initialIsUpvoted={userUpvotedIds.includes(post.id)} 
                  initialIsDownvoted={userDownvotedIds.includes(post.id)}
                  refreshFeed={fetchPosts} 
                />
              ))}
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Sidebar ═══ */}
        <aside className="lg:w-[320px] shrink-0 space-y-6">

          {/* Mentor Points Widget */}
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-purple-600/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-[60px] -mr-20 -mt-20 group-hover:bg-white/20 transition-colors" />
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                <SparkleIcon className="text-white" />
              </div>
              <h3 className="font-black text-[10px] uppercase tracking-[0.3em]">Mentor Status</h3>
            </div>
            <div className="flex items-baseline gap-2 mb-4 relative z-10">
              <span className="text-6xl font-black tracking-tighter">{mentorPoints}</span>
              <span className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Points</span>
            </div>
            <p className="text-[12px] font-medium leading-relaxed opacity-80 mb-6 relative z-10">
              Cultivate your influence. Help peers with technical doubts to ascend the leaderboard.
            </p>
            <div className="relative w-full bg-black/20 rounded-full h-2 overflow-hidden backdrop-blur-sm">
              <div className="bg-white h-full rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(255,255,255,0.5)]" style={{ width: `${Math.min(mentorPoints * 2, 100)}%` }} />
            </div>
          </div>

          {/* Community Guidelines Widget */}
          <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <ShieldIcon className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-foreground">Protocol</h3>
            </div>
            <ul className="space-y-4">
              {[
                "Strict Academic Integrity",
                "Constructive technical discourse",
                "Identity-neutral peer support",
                "Upvote quality contributions"
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-4 group">
                  <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 mt-1">0{i+1}</span>
                  <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Trending Quadrant Widget */}
          <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-amber-500/10 rounded-lg">
                <TrendingIcon className="text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-foreground">Trending</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {['FE', 'SE', 'TE', 'BE'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setFilter(tag)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    filter === tag
                      ? (yearColors[tag] || 'bg-muted text-foreground border-border')
                      : 'bg-muted/50 text-muted-foreground border-border/50 hover:text-foreground hover:border-purple-500/30'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ═══ CREATE POST MODAL ═══ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setIsModalOpen(false)}>
          <div
            className="bg-card border border-border rounded-[3rem] w-full max-w-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-10 py-8 border-b border-border/50">
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-xl bg-purple-600 flex items-center justify-center shadow-lg">
                    <PlusIcon className="text-white w-6 h-6" />
                 </div>
                 <h2 className="text-2xl font-black text-foreground tracking-tighter uppercase italic">Initiate Discussion</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-3 rounded-full hover:bg-muted transition-all text-muted-foreground hover:text-foreground active:scale-90"
              >
                <XIcon />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-10 space-y-8">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Academic Year</label>
                  <select
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    className="w-full px-5 py-4 bg-muted/50 border border-border rounded-2xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer"
                  >
                    {years.filter(y => y !== 'ALL').map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Core Department</label>
                  <select
                    value={dept}
                    onChange={e => setDept(e.target.value)}
                    className="w-full px-5 py-4 bg-muted/50 border border-border rounded-2xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer"
                  >
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Technical Discourse</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Articulate your doubt or insight here…"
                  rows={6}
                  className="w-full px-6 py-5 bg-muted/50 border border-border rounded-[1.5rem] text-[15px] font-medium text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none transition-all"
                  disabled={submitting}
                />
              </div>

              {error && (
                <div className="px-6 py-4 bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-widest rounded-2xl flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="w-full py-5 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-[0.3em] text-xs rounded-[1.5rem] transition-all disabled:opacity-40 shadow-2xl shadow-purple-600/30 active:scale-[0.98] flex items-center justify-center gap-4"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing Content…
                  </>
                ) : (
                  <>Post Anonymously</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
