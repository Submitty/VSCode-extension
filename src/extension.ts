import * as vscode from 'vscode';
import { SidebarProvider } from './sidebarProvider';
import { ApiService } from './services/apiService';
import { TestingService } from './services/testingService';
import { GitService } from './services/gitService';

export function activate(context: vscode.ExtensionContext): void {
    const apiService = ApiService.getInstance(context, '');
    const testingService = new TestingService(context, apiService);
    const gitService = new GitService();
    const sidebarProvider = new SidebarProvider(context, testingService, gitService);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('submittyWebview', sidebarProvider)
    );

}

export function deactivate() { }