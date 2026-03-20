import * as vscode from 'vscode';
import { SidebarProvider } from './sidebarProvider';
import { ApiService } from './services/apiService';
import { TestingService } from './services/testingService';

export function activate(context: vscode.ExtensionContext): void {
  const apiService = ApiService.getInstance(context, '');
  const testingService = new TestingService(context, apiService);
  const sidebarProvider = new SidebarProvider(context, testingService);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'submittyWebview',
      sidebarProvider
    )
  );
}

export function deactivate() {}
