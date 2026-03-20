// src/services/apiService.ts

import * as vscode from 'vscode';
import { ApiClient } from './apiClient';
import { CourseResponse, LoginResponse, GradableResponse } from '../interfaces/Responses';
import { AutoGraderDetails } from '../interfaces/AutoGraderDetails';

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
        return error.message || fallback;
    }
    if (typeof error === 'object' && error) {
        const maybeAxiosError = error as { response?: { data?: { message?: unknown } } };
        const msg = maybeAxiosError.response?.data?.message;
        if (typeof msg === 'string' && msg.trim()) {
            return msg;
        }
    }
    return fallback;
}

export class ApiService {
    private client: ApiClient;
    private static instance: ApiService;

    constructor(private context: vscode.ExtensionContext, apiBaseUrl: string) {
        this.client = new ApiClient(apiBaseUrl);
    }

    // set token for local api client
    setAuthorizationToken(token: string): void {
        this.client.setToken(token);
    }

    // set base URL for local api client
    setBaseUrl(baseUrl: string): void {
        this.client.setBaseURL(baseUrl);
    }

    /**
     * Login to the Submitty API
     */
    async login(userId: string, password: string): Promise<string> {
        try {
            const response = await this.client.post<LoginResponse>(
                '/api/token',
                {
                    user_id: userId,
                    password: password,
                },
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                }
            );

            const token: string = response.data.data.token;
            return token;
        } catch (error: unknown) {
            throw new Error(getErrorMessage(error, 'Login failed.'));
        }
    }

    async fetchMe(): Promise<any> {
        try {
            const response = await this.client.get<any>('/api/me');
            return response.data;
        } catch (error: unknown) {
            throw new Error(getErrorMessage(error, 'Failed to fetch me.'));
        }
    }


    /**
     * Fetch all courses for the authenticated user
     */
    async fetchCourses(_token?: string): Promise<CourseResponse> {
        try {
            const response = await this.client.get<CourseResponse>('/api/courses');
            return response.data;
        } catch (error: unknown) {
            console.error('Error fetching courses:', error);
            throw new Error(getErrorMessage(error, 'Failed to fetch courses.'));
        }
    }

    async fetchGradables(courseId: string, term: string): Promise<GradableResponse> {
        try {
            const url = `/api/${term}/${courseId}/gradeables`;
            const response = await this.client.get<GradableResponse>(url);
            return response.data;
        } catch (error: unknown) {
            console.error('Error fetching gradables:', error);
            throw new Error(getErrorMessage(error, 'Failed to fetch gradables.'));
        }
    }

    /**
     * Fetch grade details for a specific homework assignment
     */
    async fetchGradeDetails(term: string, courseId: string, gradeableId: string): Promise<AutoGraderDetails> {
        try {
            const response = await this.client.get<AutoGraderDetails>(`/api/${term}/${courseId}/gradeable/${gradeableId}/values`);
            return response.data;
        } catch (error: unknown) {
            console.error('Error fetching grade details:', error);
            throw new Error(getErrorMessage(error, 'Failed to fetch grade details.'));
        }
    }

    /**
     * Poll fetchGradeDetails until autograding_complete is true and test_cases has data.
     * @param intervalMs Delay between requests (default 2000)
     * @param timeoutMs Stop after this many ms (default 300000 = 5 min); 0 = no timeout
     * @returns The final AutoGraderDetails with complete data
     */
    async pollGradeDetailsUntilComplete(
        term: string,
        courseId: string,
        gradeableId: string,
        options?: { intervalMs?: number; timeoutMs?: number; token?: vscode.CancellationToken }
    ): Promise<AutoGraderDetails> {
        const intervalMs = options?.intervalMs ?? 2000;
        const timeoutMs = options?.timeoutMs ?? 300000;
        const token = options?.token;
        const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : 0;

        const isComplete = (res: AutoGraderDetails): boolean =>
            res?.data?.autograding_complete === true &&
            Array.isArray(res.data.test_cases) &&
            res.data.test_cases.length > 0;

        for (; ;) {
            if (token?.isCancellationRequested) {
                throw new Error('Cancelled');
            }
            if (deadline > 0 && Date.now() >= deadline) {
                throw new Error('Autograding did not complete within the timeout.');
            }

            const result = await this.fetchGradeDetails(term, courseId, gradeableId);
            if (isComplete(result)) {
                return result;
            }

            await new Promise((r) => setTimeout(r, intervalMs));
        }
    }

    async submitVCSGradable(term: string, courseId: string, gradeableId: string): Promise<any> {
        try {
            // git_repo_id is literally not used, but is required by the API *ugh*
            const url = `/api/${term}/${courseId}/gradeable/${gradeableId}/upload?vcs_upload=true&git_repo_id=true`;
            const response = await this.client.post<any>(url);
            return response.data;
        } catch (error: unknown) {
            console.error('Error submitt`ing VCS gradable:', error);
            throw new Error(getErrorMessage(error, 'Failed to submit VCS gradable.'));
        }
    }


    /**
     * Fetch previous attempts for a specific homework assignment
     */
    async fetchPreviousAttempts(term: string, courseId: string, gradeableId: string): Promise<unknown[]> {
        try {
            const url = `/api/${term}/${courseId}/gradeable/${gradeableId}/attempts`;
            const response = await this.client.get<unknown[]>(url);
            return response.data;
        } catch (error: unknown) {
            console.error('Error fetching previous attempts:', error);
            throw new Error(getErrorMessage(error, 'Failed to fetch previous attempts.'));
        }
    }

    static getInstance(context: vscode.ExtensionContext, apiBaseUrl: string): ApiService {
        if (!ApiService.instance) {
            ApiService.instance = new ApiService(context, apiBaseUrl);
        }
        return ApiService.instance;
    }
}