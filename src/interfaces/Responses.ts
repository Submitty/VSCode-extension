import { Course } from './Courses';
import { Gradable } from './Gradables';

export interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

export type CourseResponse = ApiResponse<{
  unarchived_courses: Course[];
  dropped_courses: Course[];
}>;

export type LoginResponse = ApiResponse<{
  token: string;
}>;

export type GradableResponse = ApiResponse<{
  [key: string]: Gradable;
}>;

/** Current user from `GET /api/me` (`data` field of the envelope). */
export interface User {
  user_id: string;
  user_given_name: string;
  user_family_name: string;
}

export type UserResponse = ApiResponse<User>;
