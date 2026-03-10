/**
 * Minimal typings for the built-in Git extension API (vscode.git).
 * Used for push, pull, and commit in GitService.
 */
import type { Uri } from 'vscode';

export const enum ForcePushMode {
    Force,
    ForceWithLease,
    ForceWithLeaseIfIncludes,
}

export interface CommitOptions {
    all?: boolean | 'tracked';
    amend?: boolean;
    signoff?: boolean;
    signCommit?: boolean;
    empty?: boolean;
    noVerify?: boolean;
}

export interface Repository {
    readonly rootUri: Uri;
    commit(message: string, opts?: CommitOptions): Promise<void>;
    pull(unshallow?: boolean): Promise<void>;
    push(
        remoteName?: string,
        branchName?: string,
        setUpstream?: boolean,
        force?: ForcePushMode
    ): Promise<void>;
}

export interface GitApi {
    readonly repositories: Repository[];
    getRepository(uri: Uri): Repository | null;
}

export interface GitExtension {
    readonly enabled: boolean;
    getAPI(version: 1): GitApi;
}
