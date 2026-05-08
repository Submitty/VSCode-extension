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

export type GradableResponse = ApiResponse<Gradable[]>;
