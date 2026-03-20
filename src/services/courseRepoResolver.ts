import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ApiService } from './apiService';
import { AuthService } from './authService';
import { GitService } from './gitService';
import type { Course } from '../interfaces/Courses';

export interface CourseRepoContext {
    term: string;
    courseId: string;
}

function normalizeForMatch(input: string): string {
    return input
        .toLowerCase()
        // Keep only alphanumerics so variants like "Fall 2024" vs "fall2024" match.
        .replace(/[^a-z0-9]/g, '');
}

function readTextFileSafe(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return null;
    }
}

function getGitDirPath(repoRootPath: string): string | null {
    const gitEntryPath = path.join(repoRootPath, '.git');
    if (!fs.existsSync(gitEntryPath)) {
        return null;
    }

    try {
        const stat = fs.statSync(gitEntryPath);
        if (stat.isDirectory()) {
            return gitEntryPath;
        }

        if (stat.isFile()) {
            // Worktrees/linked clones can have a .git file like: "gitdir: /abs/path/to/.git/worktrees/..."
            const gitFileContents = readTextFileSafe(gitEntryPath);
            if (!gitFileContents) {
                return null;
            }

            const match = gitFileContents.match(/^\s*gitdir:\s*(.+)\s*$/m);
            if (!match?.[1]) {
                return null;
            }

            const gitdirRaw = match[1].trim();
            return path.isAbsolute(gitdirRaw) ? gitdirRaw : path.resolve(repoRootPath, gitdirRaw);
        }
    } catch {
        return null;
    }

    return null;
}

function extractGitRemoteUrlsFromConfig(gitConfigText: string): string[] {
    const urls: string[] = [];

    // Example:
    //   [remote "origin"]
    //     url = https://example/.../term/courseId/...
    const urlRegex = /^\s*url\s*=\s*(.+)\s*$/gim;
    let match: RegExpExecArray | null = null;
    // eslint-disable-next-line no-cond-assign
    while ((match = urlRegex.exec(gitConfigText))) {
        const rawUrl = match[1]?.trim();
        if (rawUrl) {
            urls.push(rawUrl);
        }
    }

    return urls;
}

export class CourseRepoResolver {
    constructor(
        private readonly apiService: ApiService,
        private readonly authService: AuthService,
        private readonly gitService: GitService
    ) {}

    async resolveCourseContextFromRepo(): Promise<CourseRepoContext | null> {
        const repo = this.gitService.getRepository();
        if (!repo) {
            return null;
        }

        const repoRootPath = repo.rootUri.fsPath;
        const gitDirPath = getGitDirPath(repoRootPath);
        if (!gitDirPath) {
            return null;
        }

        const gitConfigText = readTextFileSafe(path.join(gitDirPath, 'config'));
        if (!gitConfigText) {
            return null;
        }

        const remoteUrls = extractGitRemoteUrlsFromConfig(gitConfigText);
        if (remoteUrls.length === 0) {
            return null;
        }

        const token = await this.authService.getAuthorizationToken();
        if (!token) {
            // No auth token -> can't map remotes to courses via API.
            return null;
        }

        const baseUrl = vscode.workspace.getConfiguration('submitty').get<string>('baseUrl', '');
        if (!baseUrl) {
            // Without baseUrl, we can't call the API.
            return null;
        }

        this.apiService.setBaseUrl(baseUrl);
        this.apiService.setAuthorizationToken(token);

        // Fetch courses and match based on whether their (term, courseId) strings appear in remote URLs.
        const coursesResponse = await this.apiService.fetchCourses(token);
        const courses = coursesResponse.data.unarchived_courses;

        const remoteText = remoteUrls.join(' ');
        const remoteNorm = normalizeForMatch(remoteText);

        let best: { course: Course; score: number } | null = null;

        for (const course of courses) {
            const courseIdNorm = normalizeForMatch(course.title);
            const termNorm = normalizeForMatch(course.semester);

            let score = 0;

            if (remoteNorm.includes(courseIdNorm)) {
                score += 6;
            }
            if (remoteNorm.includes(termNorm)) {
                score += 3;
            }
            if (remoteText.toLowerCase().includes(course.display_name.toLowerCase())) {
                score += 1;
            }

            if (!best || score > best.score) {
                best = { course, score };
            }
        }

        if (!best || best.score < 6) {
            return null;
        }

        return { term: best.course.semester, courseId: best.course.title };
    }
}

