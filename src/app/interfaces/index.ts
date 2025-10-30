export interface ILoginResponse {
  accessToken: string;
  expiresIn: number
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