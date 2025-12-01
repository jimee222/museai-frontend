export interface ILoginResponse {
  token: string;
  expiresIn: number
  authUser: IUser;
}

export interface IResponse<T> {
  data: T;
  message: string,
  meta: T;
}

export interface IUser {
  id?: number;
  firstName?: string;
  lastName1?: string;
  lastName2?: string;
  birthDate?: string;
  email?: string;
  password?: string;
  phone?: string;
  artLevel?: 'beginner' | 'intermediate' | 'advanced';
  createdAt?: string;
  updatedAt?: string;
  authorities?: IAuthority[];
  role?: IRole;
}


export interface IAuthority {
  authority: string;
}

export interface IRole {
  createdAt: string;
  description: string;
  id: number;
  name : string;
  updatedAt: string;
}

export enum IRoleType {
  admin = "ROLE_ADMIN",
  user = "ROLE_USER",
  superAdmin = 'ROLE_SUPER_ADMIN'
}

export interface IHttpResponse<T> {
  message: string;
  data: T;
  meta?: {
    method: string;
    url: string;
    totalPages?: number;
    totalElements?: number;
    pageNumber?: number;
    pageSize?: number;
  };
}

export interface ISearch {
  page?: number;
  size?: number;
  pageNumber?: number;
  pageSize?: number;
  totalElements?: number;
  totalPages?:number;
}

export interface IQuiz {
  id?: number | null;
  title: string;
  description?: string;
  imageUrl?: string;
  level?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  createdAt?: string;
  updatedAt?: string;
  questions?: IQuestion[];
  questionCount?: number;
  maxScore?: number | null;
  hasAttempt?: boolean;
  lastAttempt?: Date;
}



export interface IQuestion {
  id?: number | null;
  quizId?: number| null; 
  text: string;
  imageUrl?: string | null;
  options: IOption[];
  imagePreview?: string | null;
  selectedOptionId?: number | null;
}


export interface IOption {
  id?: number | null;
  questionId?: number; 
  text: string;
  correct: boolean;
}

export interface IQuizAttemptResponse {
  attemptId: number;
  quizId: number;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timestamp: string;
  answers: IQuizAttemptAnswerResult[];
}

export interface IQuizAttemptAnswerResult {
  questionId: number;
  questionText: string;
  selectedOptionId: number;
  selectedOptionText: string;
  correct: boolean;
}
