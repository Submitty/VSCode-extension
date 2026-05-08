import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function getLoginHtml(context: vscode.ExtensionContext): string {
  const filePath = path.join(
    context.extensionPath,
    'src',
    'sidebar',
    'login.html'
  );
  return fs.readFileSync(filePath, 'utf8');
}

export function getClassesHtml(context: vscode.ExtensionContext): string {
  const filePath = path.join(
    context.extensionPath,
    'src',
    'sidebar',
    'classes.html'
  );
  return fs.readFileSync(filePath, 'utf8');
}
