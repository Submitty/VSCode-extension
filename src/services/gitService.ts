import * as vscode from 'vscode';
import type {
  GitExtension,
  Repository,
  CommitOptions,
  ForcePushMode,
} from '../typings/vscode-git';
import { API } from '../typings/vscode-git';

/**
 * Service that delegates to the built-in vscode.git extension for
 * push, pull, and commit in the current workspace repository.
 */
export class GitService {
  private gitApi: API | null = null;

  private getApi(): API | null {
    if (this.gitApi !== null) {
      return this.gitApi;
    }
    const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!ext?.isActive) {
      return null;
    }
    try {
      this.gitApi = ext.exports.getAPI(1);
      return this.gitApi;
    } catch {
      return null;
    }
  }

  /**
   * Get the Git repository for the given URI, or the first workspace folder.
   */
  getRepository(uri?: vscode.Uri): Repository | null {
    const api = this.getApi();
    if (!api) {
      return null;
    }
    if (uri) {
      return api.getRepository(uri);
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return api.repositories.length > 0 ? api.repositories[0] : null;
    }
    return api.getRepository(folder.uri) ?? api.repositories[0];
  }

  /**
   * Commit changes in the repository. Optionally stage all changes first.
   */
  async commit(message: string, options?: CommitOptions): Promise<void> {
    const repo = this.getRepository();
    if (!repo) {
      throw new Error(
        'No Git repository found. Open a workspace folder that is a Git repo.'
      );
    }

    // check to see if there are any changes to commit
    const status = (await repo.status()) as unknown as {
      modified: unknown[];
      untracked: unknown[];
      deleted: unknown[];
    };

    if (
      status.modified.length === 0 &&
      status.untracked.length === 0 &&
      status.deleted.length === 0
    ) {
      throw new Error('No changes to commit.');
    }
    await repo.commit(message, options);
  }

  /**
   * Pull from the current branch's upstream.
   */
  async pull(): Promise<void> {
    const repo = this.getRepository();
    if (!repo) {
      throw new Error(
        'No Git repository found. Open a workspace folder that is a Git repo.'
      );
    }
    await repo.pull();
  }

  /**
   * Push the current branch. Optionally set upstream or force push.
   */
  async push(options?: {
    remote?: string;
    branch?: string;
    setUpstream?: boolean;
    force?: ForcePushMode;
  }): Promise<void> {
    const repo = this.getRepository();
    if (!repo) {
      throw new Error(
        'No Git repository found. Open a workspace folder that is a Git repo.'
      );
    }
    await repo.push(
      options?.remote,
      options?.branch,
      options?.setUpstream,
      options?.force
    );
  }
}
