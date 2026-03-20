// src/services/apiService.ts

import * as vscode from 'vscode';
import { ApiClient } from './apiClient';

import {
    CourseResponse,
    LoginResponse,
    GradableResponse,
} from '../interfaces/Responses';
import { AutoGraderDetails } from '../interfaces/AutoGraderDetails';

export class ApiService {
    private client: ApiClient;
    private static instance: ApiService;

    constructor(
        private context: vscode.ExtensionContext,
        apiBaseUrl: string
    ) {
        this.client = new ApiClient(apiBaseUrl);
    }

    /**
     * Sets the authorization token for the API client.
     * @param token - The bearer token for authenticated requests
     */
    setAuthorizationToken(token: string): void {
        this.client.setToken(token);
    }

    /**
     * Sets the base URL for the API client.
     * @param baseUrl - The base URL of the Submitty API
     */
    setBaseUrl(baseUrl: string): void {
        this.client.setBaseURL(baseUrl);
    }

    /**
     * Logs in to the Submitty API and returns an auth token.
     * @param userId - The user ID
     * @param password - The user password
     * @returns The authentication token
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
        } catch (error: any) {
            throw new Error(error.response?.data?.message || 'Login failed.');
        }
    }

    /**
     * Fetches the current authenticated user's profile from the API.
     * @returns The current user data
     */
    async fetchMe(): Promise<any> {
        try {
            const response = await this.client.get<any>('/api/me');
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.message || 'Failed to fetch me.');
        }
    }

    /**
     * Fetches all courses for the authenticated user.
     * @param token - Optional token override (currently unused)
     * @returns The course list response
     */
    async fetchCourses(token?: string): Promise<CourseResponse> {
        try {
            const response = await this.client.get<CourseResponse>('/api/courses');
            return response.data;
        } catch (error: any) {
            console.error('Error fetching courses:', error);
            throw new Error(
                error.response?.data?.message || 'Failed to fetch courses.'
            );
        }
    }

    async fetchGradables(
        courseId: string,
        term: string
    ): Promise<GradableResponse> {
        try {
            const url = `/api/${term}/${courseId}/gradeables`;
            const response = await this.client.get<GradableResponse>(url);
            return response.data;
        } catch (error: any) {
            console.error('Error fetching gradables:', error);
            throw new Error(
                error.response?.data?.message || 'Failed to fetch gradables.'
            );
        }
    }

    /**
     * Fetches all gradables (assignments) for a course.
     * @param courseId - The course ID
     * @param term - The term (e.g. "s24")
     * @returns The gradables response
     */
    async fetchGradables(
        courseId: string,
        term: string
    ): Promise<GradableResponse> {
        try {
            const url = `/api/${term}/${courseId}/gradeables`;
            const response = await this.client.get<GradableResponse>(url);
            return response.data;
        } catch (error: any) {
            console.error('Error fetching gradables:', error);
            throw new Error(
                error.response?.data?.message || 'Failed to fetch gradables.'
            );
        }
    }

    /**
     * Fetches grade details for a specific homework assignment.
     * @param term - The term (e.g. "s24")
     * @param courseId - The course ID
     * @param gradeableId - The gradeable/assignment ID
     * @returns The autograder details including test cases
     */
    async fetchGradeDetails(
        term: string,
        courseId: string,
        gradeableId: string
    ): Promise<AutoGraderDetails> {
        try {
            const response = await this.client.get<AutoGraderDetails>(
                `/api/${term}/${courseId}/gradeable/${gradeableId}/values`
            );
            return response.data;
        } catch (error: any) {
            console.error('Error fetching grade details:', error);
            throw new Error(
                error.response?.data?.message || 'Failed to fetch grade details.'
            );
        }
    }

    /**
     * Polls fetchGradeDetails until autograding is complete and test cases are available.
     * @param term - The term (e.g. "s24")
     * @param courseId - The course ID
     * @param gradeableId - The gradeable/assignment ID
     * @param options - Optional polling config: intervalMs (default 2000), timeoutMs (default 300000), token (cancellation)
     * @returns The final AutoGraderDetails with complete data
     */
    async pollGradeDetailsUntilComplete(
        term: string,
        courseId: string,
        gradeableId: string,
        options?: {
            intervalMs?: number;
            timeoutMs?: number;
            token?: vscode.CancellationToken;
        }
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

            await new Promise(r => setTimeout(r, intervalMs));
        }
    }

    /**
     * Submits a VCS (version control) gradable to trigger autograding.
     * @param term - The term (e.g. "s24")
     * @param courseId - The course ID
     * @param gradeableId - The gradeable/assignment ID
     * @returns The upload response
     */
    async submitVCSGradable(
        term: string,
        courseId: string,
        gradeableId: string
    ): Promise<any> {
        try {
            // git_repo_id is literally not used, but is required by the API *ugh*
            const url = `/api/${term}/${courseId}/gradeable/${gradeableId}/upload?vcs_upload=true&git_repo_id=true`;
            const response = await this.client.post<any>(url);
            return response.data;
        } catch (error: any) {
            console.error('Error submitting VCS gradable:', error);
            throw new Error(
                error.response?.data?.message || 'Failed to submit VCS gradable.'
            );
        }
    }

    /**
     * Fetches previous submission attempts for a specific homework assignment.
     * @param term - The term (e.g. "s24")
     * @param courseId - The course ID
     * @param gradeableId - The gradeable/assignment ID
     * @returns The list of previous attempts
     */
    async fetchPreviousAttempts(
        term: string,
        courseId: string,
        gradeableId: string
    ): Promise<any[]> {
        try {
            const url = `/api/${term}/${courseId}/gradeable/${gradeableId}/attempts`;
            const response = await this.client.get<any>(url);
            return response.data;
        } catch (error: any) {
            console.error('Error fetching previous attempts:', error);
            throw new Error(
                error.response?.data?.message || 'Failed to fetch previous attempts.'
            );
        }
    }

    /**
     * Returns the singleton ApiService instance, creating it if necessary.
     * @param context - The extension context
     * @param apiBaseUrl - The base URL of the Submitty API
     * @returns The ApiService instance
     */
    static getInstance(
        context: vscode.ExtensionContext,
        apiBaseUrl: string
    ): ApiService {
        if (!ApiService.instance) {
            ApiService.instance = new ApiService(context, apiBaseUrl);
        }
        return ApiService.instance;
    }
}
