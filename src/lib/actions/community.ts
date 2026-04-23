'use server'

import { createClient } from '@/utils/supabase/server'
import Groq from 'groq-sdk'
import { createNotification } from './notifications'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function createPost(formData: { content: string, academic_year: string, department: string }) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Please login to post.' }

  // 1. AI Moderation Guardrail
  try {
    const moderationPrompt = `Check if this engineering student's doubt is respectful and study-related. 
    If it contains abuse, spam, or non-educational nonsense, return "REJECTED". 
    Otherwise, return "APPROVED".
    
    Content: "${formData.content}"`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: moderationPrompt }],
      model: "llama-3.1-8b-instant",
    });

    const status = chatCompletion.choices[0]?.message?.content?.trim().toUpperCase();
    
    if (status?.includes("REJECTED")) {
      return { success: false, error: "Post rejected by AI moderator. Please keep it educational and respectful." };
    }
  } catch (error) {
    console.error("Moderation Error:", error);
  }

  // 2. Generate Anonymous Name
  const randomSuffixes = ['Geek', 'Byte', 'Logic', 'Sync', 'Chip', 'Null', 'Flux', 'Stack'];
  const suffix = randomSuffixes[Math.floor(Math.random() * randomSuffixes.length)];
  const anonymous_name = `${formData.academic_year}-${suffix}`;

  // 3. Save to Database
  const { error } = await supabase
    .from('community_posts')
    .insert({
      user_id: user.id,
      content: formData.content,
      academic_year: formData.academic_year,
      department: formData.department,
      anonymous_name: anonymous_name,
      upvotes: 0,
      downvotes: 0
    });

  if (error) {
    console.error("Post creation error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getPosts(academicYear: string = 'ALL') {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  let query = supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (academicYear !== 'ALL') {
    query = query.eq('academic_year', academicYear);
  }

  const { data: posts, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  // Get user's upvotes & downvotes if logged in
  let userUpvotedIds: string[] = [];
  let userDownvotedIds: string[] = [];
  
  if (user) {
    const { data: upvotes } = await supabase
      .from('post_upvotes')
      .select('post_id')
      .eq('user_id', user.id);
    
    if (upvotes) userUpvotedIds = upvotes.map(v => v.post_id);

    const { data: downvotes } = await supabase
      .from('post_downvotes')
      .select('post_id')
      .eq('user_id', user.id);
    
    if (downvotes) userDownvotedIds = downvotes.map(v => v.post_id);
  }

  return { success: true, data: posts, userUpvotedIds, userDownvotedIds };
}

export async function toggleUpvote(postId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  // Check if vote exists
  const { data: existingVote } = await supabase.from('post_upvotes').select('*').eq('user_id', user.id).eq('post_id', postId).maybeSingle();
  const { data: existingDownvote } = await supabase.from('post_downvotes').select('*').eq('user_id', user.id).eq('post_id', postId).maybeSingle();

  const { data: post } = await supabase.from('community_posts').select('upvotes, downvotes, user_id').eq('id', postId).single();
  let currentUpvotes = post?.upvotes || 0;
  let currentDownvotes = post?.downvotes || 0;

  if (existingVote) {
    // Remove upvote
    await supabase.from('post_upvotes').delete().eq('id', existingVote.id);
    currentUpvotes = Math.max(0, currentUpvotes - 1);
    await supabase.from('community_posts').update({ upvotes: currentUpvotes }).eq('id', postId);
    
    return { success: true, action: 'removed', upvotes: currentUpvotes, downvotes: currentDownvotes };
  } else {
    // Add upvote
    await supabase.from('post_upvotes').insert({ user_id: user.id, post_id: postId });
    currentUpvotes += 1;
    
    // Remove downvote if exists
    if (existingDownvote) {
      await supabase.from('post_downvotes').delete().eq('id', existingDownvote.id);
      currentDownvotes = Math.max(0, currentDownvotes - 1);
    }
    
    await supabase.from('community_posts').update({ upvotes: currentUpvotes, downvotes: currentDownvotes }).eq('id', postId);
    
    // Notification logic
    if (post?.user_id && post.user_id !== user.id) {
      await createNotification(supabase, post.user_id, 'upvote', 'Someone upvoted your post!')
    }
    
    return { success: true, action: 'added', upvotes: currentUpvotes, downvotes: currentDownvotes };
  }
}

export async function toggleDownvote(postId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const { data: existingDownvote } = await supabase.from('post_downvotes').select('*').eq('user_id', user.id).eq('post_id', postId).maybeSingle();
  const { data: existingUpvote } = await supabase.from('post_upvotes').select('*').eq('user_id', user.id).eq('post_id', postId).maybeSingle();

  const { data: post } = await supabase.from('community_posts').select('upvotes, downvotes').eq('id', postId).single();
  let currentUpvotes = post?.upvotes || 0;
  let currentDownvotes = post?.downvotes || 0;

  if (existingDownvote) {
    // Remove downvote
    await supabase.from('post_downvotes').delete().eq('id', existingDownvote.id);
    currentDownvotes = Math.max(0, currentDownvotes - 1);
    await supabase.from('community_posts').update({ downvotes: currentDownvotes }).eq('id', postId);
    
    return { success: true, action: 'removed', upvotes: currentUpvotes, downvotes: currentDownvotes };
  } else {
    // Add downvote
    await supabase.from('post_downvotes').insert({ user_id: user.id, post_id: postId });
    currentDownvotes += 1;
    
    // Remove upvote if exists
    if (existingUpvote) {
      await supabase.from('post_upvotes').delete().eq('id', existingUpvote.id);
      currentUpvotes = Math.max(0, currentUpvotes - 1);
    }
    
    await supabase.from('community_posts').update({ upvotes: currentUpvotes, downvotes: currentDownvotes }).eq('id', postId);
    
    return { success: true, action: 'added', upvotes: currentUpvotes, downvotes: currentDownvotes };
  }
}

export async function addReply(postId: string, content: string, postYear: string, replierYear: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Please login to reply.' }

  // 1. AI Moderation
  try {
    const moderationPrompt = `Check if this reply is respectful. Return "REJECTED" if spam/abuse, else "APPROVED". Content: "${content}"`;
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: moderationPrompt }],
      model: "llama-3.1-8b-instant",
    });
    if (chatCompletion.choices[0]?.message?.content?.trim().toUpperCase().includes("REJECTED")) {
      return { success: false, error: "Reply rejected by AI moderator." };
    }
  } catch (error) {
    console.error("Moderation Error:", error);
  }

  // 2. Generate Anonymous Name
  const randomSuffixes = ['Ninja', 'Guru', 'Pro', 'Wizard', 'Jedi', 'Sensei'];
  const suffix = randomSuffixes[Math.floor(Math.random() * randomSuffixes.length)];
  const anonymous_name = `Reply-${suffix}`;

  // 3. Insert Reply
  const { error } = await supabase
    .from('post_replies')
    .insert({
      post_id: postId,
      user_id: user.id,
      content,
      anonymous_name
    });

  if (error) return { success: false, error: error.message };

  // Notify Post Owner
  const { data: post } = await supabase.from('community_posts').select('user_id').eq('id', postId).single();
  if (post?.user_id && post.user_id !== user.id) {
    await createNotification(supabase, post.user_id, 'reply', 'Someone replied to your post!')
  }

  // 4. Mentor Points Logic
  const yearValues: Record<string, number> = { 'FE': 1, 'SE': 2, 'TE': 3, 'BE': 4 };
  const postYearVal = yearValues[postYear] || 0;
  const replierYearVal = yearValues[replierYear] || 0;

  if (replierYearVal > postYearVal) {
    // Add 10 mentor points
    const { data: profile } = await supabase.from('profiles').select('mentor_points').eq('id', user.id).single();
    const currentPoints = profile?.mentor_points || 0;
    await supabase.from('profiles').update({ mentor_points: currentPoints + 10 }).eq('id', user.id);
    
    // Notify Earner
    await createNotification(supabase, user.id, 'mentor', 'You earned +10 Mentor Points for helping a junior!')
  }

  return { success: true };
}

export async function getReplies(postId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('post_replies')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function getMentorPoints() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const { data, error } = await supabase
    .from('profiles')
    .select('mentor_points')
    .eq('id', user.id)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data?.mentor_points || 0 };
}
