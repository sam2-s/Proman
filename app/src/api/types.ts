export type Role = 'owner' | 'editor' | 'viewer';

export interface User {
  id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  is_admin: boolean;
  created_at?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  created_at: string;
  role?: Role;
}

export interface Member {
  project_id: number;
  user_id: number;
  role: Role;
  name: string;
  username: string;
  avatar_url: string | null;
}

export interface Board {
  id: number;
  project_id: number;
  name: string;
  created_at: string;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
}

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string;
  priority: Priority;
  position: number;
  due_date: string | null;
  start_date: string | null;
  assignee_id: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: number;
  card_id: number;
  title: string;
  done: number;
  position: number;
}

export interface Comment {
  id: number;
  card_id: number;
  user_id: number;
  body: string;
  created_at: string;
  author_name: string;
}

export interface Attachment {
  id: number;
  card_id: number;
  filename: string;
  stored_name: string;
  mime: string;
  size: number;
  uploaded_by: number | null;
  created_at: string;
}

export interface BoardMember {
  user_id: number;
  name: string;
  username: string;
  avatar_url: string | null;
  role: Role;
}

export interface CardDetail {
  card: Card;
  members: BoardMember[];
}

export interface BoardDetail {
  board: Board;
  columns: { column: Column; cards: Card[] }[];
  members?: BoardMember[];
}

export interface ProjectDetail {
  project: Project;
  members: Member[];
  boards: Board[];
}

export interface ActivityItem {
  id: number;
  project_id: number;
  user_id: number | null;
  card_id: number | null;
  verb: string;
  summary: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  project_id: number;
  card_id: number | null;
  body: string;
  read: number;
  created_at: string;
}

export interface SearchResult {
  id: number;
  title: string;
  priority: Priority;
  due_date: string | null;
  column_id: number;
  column_name: string;
  board_id: number;
  board_name: string;
  project_id: number;
  project_name: string;
}
