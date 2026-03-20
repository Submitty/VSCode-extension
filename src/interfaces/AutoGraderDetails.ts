export interface AutoGraderDetails {
  status: string;
  data: AutoGraderDetailsData;
}

export interface AutoGraderDetailsData {
  is_queued: boolean;
  queue_position: number;
  is_grading: boolean;
  has_submission: boolean;
  autograding_complete: boolean;
  has_active_version: boolean;
  highest_version: number;
  total_points: number;
  total_percent: number;
  test_cases: TestCase[];
}

export interface TestCase {
  name: string;
  details: string;
  is_extra_credit: boolean;
  points_available: number;
  has_extra_results: boolean;
  points_received: number;
  testcase_message: string;
  autochecks: Autocheck[];
}

export interface Autocheck {
  description: string;
  messages: Message[];
  diff_viewer: Record<string, string>;
  expected: string;
  actual: string;
}

export interface Message {
  message: string;
  type: string;
}
