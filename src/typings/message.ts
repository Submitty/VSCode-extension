export const MessageCommand = {
  FETCH_AND_DISPLAY_COURSES: 'fetchAndDisplayCourses',
  DISPLAY_COURSES: 'displayCourses',
  GRADE: 'grade',
  GRADE_STARTED: 'gradeStarted',
  GRADE_COMPLETED: 'gradeCompleted',
  GRADE_ERROR: 'gradeError',
  GRADE_CANCELLED: 'gradeCancelled',
  GRADE_PAUSED: 'gradePaused',
  GRASE_RESUMED: 'gradeResumed',
  GRADE_ABORTED: 'gradeAborted',
  ERROR: 'error',
} as const;

export type WebViewMessage = {
  command: (typeof MessageCommand)[keyof typeof MessageCommand];
  [key: string]: string | number | boolean | object | null | undefined;
};
