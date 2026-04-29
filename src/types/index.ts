export type Language = 'English' | 'Hindi' | 'Marathi' | 'Tamil' | 'Telugu';

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_language: Language;
  bio: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'completed';
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  document_type: 'study_material' | 'syllabus';
  created_at: string;
}

export interface StudyPlanDay {
  day: number;
  topic: string;
  description: string;
  tasks: string[];
}

export interface StudyPlanContent {
  top_topics: string[];
  schedule: StudyPlanDay[];
}

export interface StudyPlan {
  id: string;
  user_id: string;
  document_id: string | null;
  plan_content: StudyPlanContent;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface VivaSession {
  id: string;
  user_id: string;
  topic: string;
  language: Language;
  messages: ChatMessage[];
  final_score: number | null;
  created_at: string;
}

export interface PrepPilotSession {
  id: string;
  user_id: string;
  title: string;
  is_panic_mode: boolean;
  created_at: string;
}

export interface PrepPilotMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
