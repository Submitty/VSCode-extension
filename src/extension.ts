import * as vscode from 'vscode';
import { SidebarProvider } from './sidebarProvider';
import { ApiService } from './services/apiService';
import { TestingService } from './services/testingService';
import { GitService } from './services/gitService';
import { AuthService } from './services/authService';
import { CourseRepoResolver } from './services/courseRepoResolver';
import type { Gradable } from './interfaces/Gradables';

export function activate(context: vscode.ExtensionContext): void {
    const apiService = ApiService.getInstance(context, '');
    const testingService = new TestingService(context, apiService);
    const gitService = new GitService();
    const authService = AuthService.getInstance(context);
    const sidebarProvider = new SidebarProvider(context, testingService, gitService);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('submittyWebview', sidebarProvider)
    );

    // Preload gradables into the Test Explorer when the workspace appears
    // to be a course-tied repo.
    void (async () => {
        try {
            await authService.initialize();
            const resolver = new CourseRepoResolver(apiService, authService, gitService);
            const courseContext = await resolver.resolveCourseContextFromRepo();
            if (!courseContext) {
                return;
            }

            const gradablesResponse = await apiService.fetchGradables(courseContext.courseId, courseContext.term);
            const gradables = Object.values(gradablesResponse.data);

            for (const g of gradables) {
                testingService.addGradeable(courseContext.term, courseContext.courseId, g.id, g.title || g.id);
            }
        } catch (e) {
            const err = e instanceof Error ? e.message : String(e);
            console.warn(`Failed to preload gradables: ${err}`);
        }
    })();

}

export function deactivate() { }