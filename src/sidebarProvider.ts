import * as vscode from 'vscode';
import { getClassesHtml } from './sidebarContent';
import { ApiService } from './services/apiService';
import { AuthService } from './services/authService';
import { GitService } from './services/gitService';
import type { TestingService } from './services/testingService';
import { Gradable } from './interfaces/Gradables';
import { TestingService } from './services/testingService';
import { MessageCommand } from './typings/message';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private apiService: ApiService;
  private authService: AuthService;
  private isInitialized: boolean = false;
  private visibilityDisposable?: vscode.Disposable;
  private isLoadingCourses: boolean = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly testingService?: TestingService,
    private readonly gitService?: GitService
  ) {
    this.apiService = ApiService.getInstance(this.context, '');
    this.authService = AuthService.getInstance(this.context);
  }

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview'),
      ],
    };

    // Initially show blank screen
    webviewView.webview.html = this.getBlankHtml();

    // Reload courses any time the view becomes visible again (e.g. user
    // closes/hides the panel and comes back).
    this.visibilityDisposable?.dispose();
    this.visibilityDisposable = webviewView.onDidChangeVisibility(async () => {
      if (webviewView.visible) {
        await this.loadCourses();
      }
    });

    // Initialize authentication when sidebar is opened (only once)
    if (!this.isInitialized) {
      this.isInitialized = true;
      try {
        await this.authService.initialize();

        // After authentication, fetch and display courses
        await this.loadCourses();
      } catch (error: any) {
        console.error('Authentication initialization failed:', error);
        // Error is already shown to user in authService
      }
    } else {
      // If already initialized, just load courses
      await this.loadCourses();
    }

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async message => {
        await this.handleMessage(message, webviewView);
      },
      undefined,
      this.context.subscriptions
    );
  }

  private async loadCourses(): Promise<void> {
    if (!this._view) {
      return;
    }

    if (this.isLoadingCourses) {
      return;
    }

    this.isLoadingCourses = true;
    try {
      const token = await this.authService.getAuthorizationToken();
      if (!token) {
        return;
      }

      // Show classes HTML
      this._view.webview.html = getClassesHtml(this.context);

      // Fetch and display courses
      await this.fetchAndDisplayCourses(token, this._view);
    } catch (error: unknown) {
      const err = error instanceof Error ? error.message : String(error);
      console.error('Failed to load courses:', error);
      vscode.window.showErrorMessage(`Failed to load courses: ${err}`);
    } finally {
      this.isLoadingCourses = false;
    }
  }

  private async handleMessage(
    message: unknown,
    view: vscode.WebviewView
  ): Promise<void> {
    console.log('handleMessage', message);
    if (!message || typeof message !== 'object') {
      return;
    }
    const msg = message as { command?: unknown; data?: unknown };
    if (typeof msg.command !== 'string') {
      return;
    }

    switch (msg.command) {
      case MessageCommand.FETCH_AND_DISPLAY_COURSES:
        try {
          const token = await this.authService.getAuthorizationToken();
          if (token) {
            await this.fetchAndDisplayCourses(token, view);
          }
        } catch (error: unknown) {
          const err = error instanceof Error ? error.message : String(error);
          console.error('Failed to fetch and display courses:', error);
          view.webview.postMessage({
            command: MessageCommand.ERROR,
            data: { message: `Failed to fetch and display courses: ${err}` },
          });
        }
        break;
      case MessageCommand.GRADE:
        try {
          const data = msg.data;
          if (!data || typeof data !== 'object') {
            throw new Error('Missing grade payload.');
          }
          const dataObj = data as Record<string, unknown>;
          const term = typeof dataObj.term === 'string' ? dataObj.term : null;
          const courseId =
            typeof dataObj.courseId === 'string' ? dataObj.courseId : null;
          const gradeableId =
            typeof dataObj.gradeableId === 'string'
              ? dataObj.gradeableId
              : null;

          if (!term || !courseId || !gradeableId) {
            throw new Error('Invalid grade payload.');
          }
          console.log('handleGrade', term, courseId, gradeableId);
          await this.handleGrade(term, courseId, gradeableId, view);
        } catch (error: unknown) {
          const err = error instanceof Error ? error.message : String(error);
          console.error('Failed to grade:', error);
          view.webview.postMessage({
            command: MessageCommand.ERROR,
            data: { message: `Failed to grade: ${err}` },
          });
        }
        break;
      default:
        vscode.window.showWarningMessage(`Unknown command: ${msg.command}`);
        view.webview.postMessage({
          command: MessageCommand.ERROR,
          data: { message: `Unknown command: ${msg.command}` },
        });
        break;
    }
  }
  private async fetchAndDisplayCourses(
    token: string,
    view: vscode.WebviewView
  ): Promise<void> {
    try {
      const courses = await this.apiService.fetchCourses(token);
      const unarchived = courses.data.unarchived_courses;

      const coursesWithGradables = await Promise.all(
        unarchived.map(async course => {
          let gradables: { id: string; title: string }[] = [];
          try {
            const gradableResponse = await this.apiService.fetchGradables(
              course.title,
              course.semester
            );
            gradables = Object.values(gradableResponse.data || {}).map(
              (g: Gradable) => ({ id: g.id, title: g.title || g.id })
            );
          } catch (e) {
            console.warn(`Failed to fetch gradables for ${course.title}:`, e);
          }
          return {
            semester: course.semester,
            title: course.title,
            display_name: course.display_name || course.title,
            gradables,
          };
        })
      );

      view.webview.postMessage({
        command: MessageCommand.DISPLAY_COURSES,
        data: { courses: coursesWithGradables },
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to fetch courses: ${err}`);
      view.webview.postMessage({
        command: MessageCommand.ERROR,
        data: { message: `Failed to fetch courses: ${err}` },
      });
    }
  }

  private async handleGrade(
    term: string,
    courseId: string,
    gradeableId: string,
    view: vscode.WebviewView
  ): Promise<void> {
    try {
      this.testingService?.addGradeable(
        term,
        courseId,
        gradeableId,
        gradeableId
      );

      if (this.gitService) {
        view.webview.postMessage({
          command: MessageCommand.GRADE_STARTED,
          data: { message: 'Staging and committing...' },
        });
        const commitMessage = new Date().toLocaleString(undefined, {
          dateStyle: 'short',
          timeStyle: 'medium',
        });
        try {
          await this.gitService.commit(commitMessage, { all: true });
          view.webview.postMessage({
            command: MessageCommand.GRADE_STARTED,
            data: { message: 'Pushing...' },
          });
          await this.gitService.push();
        } catch (error: unknown) {
          const err = error instanceof Error ? error.message : String(error);
          if (err === 'No changes to commit.') {
            view.webview.postMessage({
              command: MessageCommand.GRADE_STARTED,
              data: { message: 'No changes to commit. Skipping git push.' },
            });
          } else {
            throw error;
          }
        }
      }

      view.webview.postMessage({
        command: MessageCommand.GRADE_STARTED,
        data: { message: 'Submitting for grading...' },
      });
      await this.apiService.submitVCSGradable(term, courseId, gradeableId);

      view.webview.postMessage({
        command: MessageCommand.GRADE_STARTED,
        data: { message: 'Grading in progress. Polling for results...' },
      });
      const gradeDetails = await this.apiService.pollGradeDetailsUntilComplete(
        term,
        courseId,
        gradeableId
      );
      const previousAttempts = await this.apiService.fetchPreviousAttempts(
        term,
        courseId,
        gradeableId
      );

      view.webview.postMessage({
        command: MessageCommand.GRADE_COMPLETED,
        data: {
          term,
          courseId,
          gradeableId,
          gradeDetails,
          previousAttempts,
        },
      });

      this.testingService?.runGradeableWithResult(
        term,
        courseId,
        gradeableId,
        gradeableId,
        gradeDetails
      );
    } catch (error: unknown) {
      const err = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to grade: ${err}`);
      view.webview.postMessage({
        command: MessageCommand.ERROR,
        data: { message: `Failed to grade: ${err}` },
      });
    }
  }

  private getBlankHtml(): string {
    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Submitty</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 10px;
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                </style>
            </head>
            <body>
            </body>
            </html>
        `;
  }
}
