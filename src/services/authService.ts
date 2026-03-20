import * as vscode from 'vscode';
import { ApiService } from './apiService';
import * as keytar from 'keytar';

export class AuthService {
    // we need to store the token in the global state, but also store it in the
    // system keychain
    private context: vscode.ExtensionContext;
    private apiService: ApiService;
    private static instance: AuthService;
    constructor(context: vscode.ExtensionContext, apiBaseUrl: string = "") {
        this.context = context;
        this.apiService = ApiService.getInstance(context, "");
    }

    async initialize(): Promise<void> {
        console.log("Initializing AuthService");

        // Get base URL from configuration
        const config = vscode.workspace.getConfiguration('submitty');
        let baseUrl = config.get<string>('baseUrl', '');

        // If base URL is configured, set it on the API service
        if (baseUrl) {
            this.apiService.setBaseUrl(baseUrl);
        }

        const token = await this.getToken();
        console.log("Token:", token);
        if (token) {
            // Token exists, set it on the API service
            this.apiService.setAuthorizationToken(token);
            console.log("Token set on API service");

            // If baseUrl isn't configured yet, fetch it now so API calls work.
            if (!baseUrl) {
                const inputUrl = await vscode.window.showInputBox({
                    prompt: 'Enter Submitty API URL',
                    placeHolder: 'https://example.submitty.edu',
                    ignoreFocusOut: true,
                    validateInput: (value) => {
                        if (!value || value.trim().length === 0) {
                            return 'URL is required';
                        }
                        try {
                            new URL(value);
                            return null;
                        } catch {
                            return 'Please enter a valid URL';
                        }
                    },
                });

                if (!inputUrl) {
                    return;
                }

                baseUrl = inputUrl.trim();

                await config.update('baseUrl', baseUrl, vscode.ConfigurationTarget.Global);
                this.apiService.setBaseUrl(baseUrl);
            }

            return;
        }

        console.log("No token found, prompting for credentials");

        // If no base URL is configured, prompt for it
        if (!baseUrl) {
            const inputUrl = await vscode.window.showInputBox({
                prompt: 'Enter Submitty API URL',
                placeHolder: 'https://example.submitty.edu',
                ignoreFocusOut: true,
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'URL is required';
                    }
                    try {
                        new URL(value);
                        return null;
                    } catch {
                        return 'Please enter a valid URL';
                    }
                }
            });

            if (!inputUrl) {
                // User cancelled
                return;
            }

            baseUrl = inputUrl.trim();

            // Save base URL to configuration
            await config.update('baseUrl', baseUrl, vscode.ConfigurationTarget.Global);

            // Set the base URL on the API service
            this.apiService.setBaseUrl(baseUrl);
        }

        const userId = await vscode.window.showInputBox({
            prompt: 'Enter your Submitty username',
            placeHolder: 'Username',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Username is required';
                }
                return null;
            }
        });

        if (!userId) {
            // User cancelled
            return;
        }

        const password = await vscode.window.showInputBox({
            prompt: 'Enter your Submitty password',
            placeHolder: 'Password',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Password is required';
                }
                return null;
            }
        });

        if (!password) {
            // User cancelled
            return;
        }

        // Update API service with URL and login
        try {
            // Perform login
            await this.login(userId.trim(), password);

            vscode.window.showInformationMessage('Successfully logged in to Submitty');
        } catch (error: unknown) {
            const err = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Login failed: ${err}`);
            throw error;
        }
    }

    // store token
    private async storeToken(token: string): Promise<void> {
        await keytar.setPassword('submittyToken', 'submittyToken', token);
    }

    // get token
    private async getToken(): Promise<string | null> {
        return await keytar.getPassword('submittyToken', 'submittyToken');
    }

    // public method to get token
    async getAuthorizationToken(): Promise<string | null> {
        return await this.getToken();
    }

    private async login(userId: string, password: string): Promise<string> {
        const token = await this.apiService.login(userId, password);
        this.apiService.setAuthorizationToken(token);
        // store token in system keychain
        await this.storeToken(token);
        return token;
    }

    static getInstance(context: vscode.ExtensionContext, apiBaseUrl: string = ""): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService(context);
        }
        return AuthService.instance;
    }
}
