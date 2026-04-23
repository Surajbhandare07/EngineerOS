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
const yearColors: Record<string, string> = {
  FE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  SE: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  TE: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  BE: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
}

/* ═════════════════════════════════════════════
   POST CARD COMPONENT
   ═════════════════════════════════════════════ */
function PostCard({ post, initialIsUpvoted, initialIsDownvoted, refreshFeed }: { post: any, initialIsUpvoted: boolean, initialIsDownvoted: boolean, refreshFeed: () => void }) {
  const [isUpvoted, setIsUpvoted] = useState(initialIsUpvoted)
  const [isDownvoted, setIsDownvoted] = useState(initialIsDownvoted)
  const [upvotes, setUpvotes] = useState(post.upvotes || 0)
  const [downvotes, setDownvotes] = useState(post.downvotes || 0)
  
  // Reply State
  const [showReplies, setShowReplies] = useState(false)
  const [replies, setReplies] = useState<any[]>([])
  const [replyContent, setReplyContent] = useState('')
  const [replyYear, setReplyYear] = useState('FE')
  const [replying, setReplying] = useState(false)
  
  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleUpvoteClick = async () => {
    // Optimistic Update
    setIsUpvoted(!isUpvoted)
    setUpvotes(isUpvoted ? Math.max(0, upvotes - 1) : upvotes + 1)
    if (!isUpvoted && isDownvoted) {
      setIsDownvoted(false)
      setDownvotes(Math.max(0, downvotes - 1))
    }
    
    const res = await toggleUpvote(post.id)
    if (res.success) {
      // Sync exact DB counts
      setUpvotes(res.upvotes)
      setDownvotes(res.downvotes)
    } else {
      showToast("Failed to sync upvote")
      refreshFeed()
    }
  }

  const handleDownvoteClick = async () => {
    // Optimistic Update
    setIsDownvoted(!isDownvoted)
    setDownvotes(isDownvoted ? Math.max(0, downvotes - 1) : downvotes + 1)
    if (!isDownvoted && isUpvoted) {
      setIsUpvoted(false)
      setUpvotes(Math.max(0, upvotes - 1))
    }
    
    const res = await toggleDownvote(post.id)
    if (res.success) {
      // Sync exact DB counts
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
       refreshFeed() // Call this to potentially refresh mentor points if they gained some
       showToast("Reply posted successfully!")
    } else {
       showToast(res.error || "Failed to post reply")
    }
    setReplying(false)
  }

  const gradient = getAvatarGradient(post.anonymous_name)
  const yrClass = yearColors[post.academic_year] || 'bg-gray-800 text-gray-400 border-gray-700'

  return (
    <article className="relative bg-gray-900 border border-gray-800/80 rounded-2xl p-5 hover:shadow-lg hover:shadow-black/20 hover:border-gray-700/80 transition-all duration-300">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg border border-gray-700 z-10 animate-in">
          {toastMessage}
        </div>
      )}

      {/* Card Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm`}>
          {post.anonymous_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[15px] text-white">{post.anonymous_name}</span>
            <span className="text-gray-600 text-xs">•</span>
            <span className="text-gray-500 text-xs">{timeAgo(post.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${yrClass}`}>
              {post.academic_year}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/50">
              {post.department}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="text-[15px] text-gray-300 leading-relaxed whitespace-pre-wrap pl-[52px]">
        {post.content}
      </p>

      {/* Action Bar */}
      <div className="flex items-center gap-1 mt-4 pl-[52px]">
        
        {/* Vote Group */}
        <div className="flex items-center bg-gray-800/50 rounded-full border border-gray-700/50 p-0.5 mr-2">
          <button
            onClick={handleUpvoteClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              isUpvoted
                ? 'text-purple-400 bg-purple-500/10'
                : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
            }`}
          >
            <ThumbsUpIcon filled={isUpvoted} className={isUpvoted ? 'text-purple-400' : 'text-gray-500'} />
            <span>{upvotes}</span>
          </button>
          
          <div className="w-px h-4 bg-gray-700 mx-1"></div>
          
          <button
            onClick={handleDownvoteClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              isDownvoted
                ? 'text-red-400 bg-red-500/10'
                : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
            }`}
          >
            <ThumbsDownIcon filled={isDownvoted} className={isDownvoted ? 'text-red-400' : 'text-gray-500'} />
            <span>{downvotes > 0 ? downvotes : ''}</span>
          </button>
        </div>

        <button 
          onClick={toggleReplies}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            showReplies ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
          }`}
        >
          <MessageIcon />
          <span>Reply {replies.length > 0 && `(${replies.length})`}</span>
        </button>

        <button 
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-all duration-200"
        >
          <ShareIcon />
          <span>Share</span>
        </button>
      </div>

      {/* Replies Section */}
      {showReplies && (
        <div className="mt-5 pl-[52px] border-t border-gray-800/50 pt-5 space-y-4">
          
          {/* Display Replies */}
          {replies.length > 0 ? (
            <div className="space-y-3">
              {replies.map(r => {
                const repGrad = getAvatarGradient(r.anonymous_name);
                return (
                  <div key={r.id} className="flex gap-3 animate-in">
                    <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${repGrad} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {r.anonymous_name.charAt(0)}
                    </div>
                    <div className="bg-gray-800/40 rounded-2xl rounded-tl-none p-3.5 flex-1 border border-gray-700/30">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-[13px] text-white">{r.anonymous_name}</span>
                        <span className="text-[11px] text-gray-500">{timeAgo(r.created_at)}</span>
                      </div>
                      <p className="text-[13px] text-gray-300 leading-relaxed">{r.content}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">No replies yet. Be the first to help!</div>
          )}

          {/* Reply Input Form */}
          <form onSubmit={handleReplySubmit} className="flex gap-2 items-start pt-2">
            <select 
              value={replyYear} 
              onChange={e => setReplyYear(e.target.value)} 
              className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-xl px-2 py-2.5 focus:outline-none focus:border-purple-500/50"
            >
              <option value="FE">FE</option><option value="SE">SE</option><option value="TE">TE</option><option value="BE">BE</option>
            </select>
            <input
              type="text"
              value={replyContent}
              onChange={e => setReplyContent(e.target.value)}
              placeholder="Add a reply..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-[13px] text-white focus:outline-none focus:border-purple-500/50"
              disabled={replying}
            />
            <button 
              type="submit" 
              disabled={replying || !replyContent.trim()} 
              className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {replying ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Send'}
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

  // New post state
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

  /* Client-side search filter */
  const filteredPosts = searchQuery.trim()
    ? posts.filter(p => p.content.toLowerCase().includes(searchQuery.toLowerCase()) || p.anonymous_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : posts

  /* ────────────────────── RENDER ────────────────────── */
  return (
    <div className="max-w-6xl mx-auto">

      {/* ─── Page Header ─── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Engineering Square</h1>
        <p className="text-gray-500 mt-1 text-[15px]">Ask doubts anonymously. Help your peers. Learn together.</p>
      </div>

      {/* ─── 2-Column Grid ─── */}
      <div className="flex gap-8">

        {/* ═══ LEFT: Feed Column ═══ */}
        <div className="flex-1 min-w-0">

          {/* ── Search Bar (Google pill) ── */}
          <div className="relative mb-4">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search doubts, topics, or keywords…"
              className="w-full pl-12 pr-4 py-3.5 bg-gray-900 border border-gray-800 rounded-full text-[15px] text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
            />
          </div>

          {/* ── Create-a-post prompt ── */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full mb-6 flex items-center gap-3 px-5 py-3.5 bg-gray-900 border border-gray-800 rounded-2xl text-gray-500 hover:border-gray-700 hover:bg-gray-900/80 transition-all group"
          >
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shrink-0">
              <UserIcon className="text-white w-4 h-4" />
            </div>
            <span className="text-[15px] group-hover:text-gray-400 transition-colors">What&apos;s your engineering doubt?</span>
            <div className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-600/10 text-purple-400 text-xs font-medium">
              <PlusIcon className="w-3.5 h-3.5" />
              Post
            </div>
          </button>

          {/* ── Filter Chips ── */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setFilter(y)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border ${
                  filter === y
                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                    : 'bg-transparent text-gray-400 border-gray-800 hover:bg-gray-800/60 hover:text-gray-300'
                }`}
              >
                {y === 'ALL' ? '🔥 All Posts' : y}
              </button>
            ))}
          </div>

          {/* ── Feed Content ── */}
          {loading ? (
            <div className="flex justify-center py-24">
              <Spinner />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl py-20 px-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-5">
                <MessageIcon className="text-gray-500 w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">No posts yet</h3>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">Be the first to ask a doubt or start a discussion in the Engineering Square.</p>
            </div>
          ) : (
            <div className="space-y-4">
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

        {/* ═══ RIGHT: Sidebar (hidden on mobile) ═══ */}
        <aside className="hidden lg:block w-[300px] shrink-0 space-y-5">

          {/* Community Rules Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldIcon className="text-purple-400" />
              <h3 className="font-semibold text-white text-sm">Community Guidelines</h3>
            </div>
            <ul className="space-y-3 text-[13px] text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">1.</span>
                <span>Keep it respectful and educational.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">2.</span>
                <span>All posts are AI-moderated for safety.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">3.</span>
                <span>Your identity is always anonymous.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">4.</span>
                <span>Help others—upvote useful doubts.</span>
              </li>
            </ul>
          </div>

          {/* Trending Tags */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingIcon className="text-purple-400" />
              <h3 className="font-semibold text-white text-sm">Trending Tags</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {['FE', 'SE', 'TE', 'BE'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setFilter(tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    filter === tag
                      ? (yearColors[tag] || 'bg-gray-800 text-gray-400 border-gray-700')
                      : 'bg-gray-800/50 text-gray-500 border-gray-700/50 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Mentor Points */}
          <div className="bg-gradient-to-br from-purple-900/30 to-violet-900/20 border border-purple-500/15 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <SparkleIcon className="text-purple-400" />
              <h3 className="font-semibold text-white text-sm">🏆 Your Mentor Points</h3>
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl font-bold text-white">{mentorPoints}</span>
              <span className="text-sm text-gray-400">pts</span>
            </div>
            <p className="text-[12px] text-gray-500 leading-relaxed">
              Earn points by posting doubts, helping peers, and getting upvotes. Top mentors get featured every week.
            </p>
            <div className="mt-3 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-violet-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(mentorPoints * 2, 100)}%` }} />
            </div>
          </div>
        </aside>
      </div>

      {/* ═══ CREATE POST MODAL ═══ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div
            className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/50 overflow-hidden animate-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">New Discussion</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-800 transition-colors text-gray-500 hover:text-white"
              >
                <XIcon />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Selects Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Year</label>
                  <select
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                  >
                    {years.filter(y => y !== 'ALL').map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Department</label>
                  <select
                    value={dept}
                    onChange={e => setDept(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                  >
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Your Doubt</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Describe your doubt in detail…"
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-[15px] text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 resize-none transition-colors"
                  disabled={submitting}
                />
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[15px] rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Moderating your post…
                  </>
                ) : (
                  'Post Anonymously'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Inline animation style */}
      <style jsx>{`
        .animate-in {
          animation: modal-in 0.2s ease-out;
        }
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
