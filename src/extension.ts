import * as vscode from 'vscode';
import { SidebarProvider } from './sidebarProvider';
import ReactWebview from './reactWebview';
import { ExtensionContextUtil } from './util/extensionContextUtil';
import { ApiService } from './services/apiService';
import { TestingService } from './services/testingService';

export function activate(context: vscode.ExtensionContext) {
    ExtensionContextUtil.getExtensionContext(context);
    const apiService = ApiService.getInstance(context, '');
    const testingService = new TestingService(context, apiService);
    const sidebarProvider = new SidebarProvider(context, testingService);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('submittyWebview', sidebarProvider)
    );

    // context.subscriptions.push(
    //     vscode.window.registerWebviewViewProvider(
    //         ReactWebview.viewType,
    //         ReactWebview.getInstance(context.extensionUri),
    //     )
    // );
}

export function deactivate() { }