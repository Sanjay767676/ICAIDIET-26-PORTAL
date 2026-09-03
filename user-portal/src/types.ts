export type UserRole = 'USER' | 'ADMIN';

export type SubmissionStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'REVISION_REQUIRED'
  | 'ACCEPTED'
  | 'REJECTED';

export type SubmissionFileType = 'MANUSCRIPT' | 'SUPPORTING';

export interface UserProfile {
  institution: string;
  department: string;
  country: string;
  phone: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  profile?: UserProfile | null;
}

export interface SubmissionFile {
  id: string;
  submission_id?: string;
  file_type: SubmissionFileType;
  original_filename: string;
  storage_key: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface Submission {
  id: string;
  submission_code: string;
  title: string;
  abstract: string;
  keywords: string;
  user_id?: string;
  status: SubmissionStatus;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    name: string;
    email: string;
    institution: string;
    department?: string;
    country?: string;
    phone?: string;
  };
  files?: SubmissionFile[];
}

export interface DashboardStats {
  totalUsers: number;
  totalSubmissions: number;
  submitted: number;
  underReview: number;
  revisionRequired: number;
  accepted: number;
  rejected: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
