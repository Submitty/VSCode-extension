/**
 * ReactWebview is a class that implements the WebviewViewProvider interface.
 * It is used to create a webview view that displays a React application.
 * Highly inspired by https://github.com/jallen-dev/vscode-react-starter/blob/main/src/VscodeReactStarterView.ts
 * Which was inspired by https://github.com/estruyf/vscode-front-matter/blob/3a0fe7b4db18ef10285f908a3a4d4efe9503afeb/src/explorerView/ExplorerView.ts
 */

import { CancellationToken, Disposable, Uri, Webview, WebviewView, WebviewViewProvider, WebviewViewResolveContext, window } from "vscode";
import { getNonce } from "./util/getNonce";
import { ExtensionContextUtil } from "./util/extensionContextUtil";
import { getUri } from "./util/getUri";

class ReactWebview implements WebviewViewProvider {
    public static readonly viewType = 'reactWebview';
    private static instance: ReactWebview;
    private _disposables: Disposable[] = [];

    private _view?: WebviewView;

    constructor(private readonly _extensionUri: Uri) { }

    public static getInstance(_extensionUri: Uri): ReactWebview {
        if (!ReactWebview.instance) {
            ReactWebview.instance = new ReactWebview(_extensionUri);
        }
        return ReactWebview.instance;
    }

    public resolveWebviewView(webviewView: WebviewView, _context: WebviewViewResolveContext, _token: CancellationToken): void | Thenable<void> {
        this._view = webviewView;
 
        this._view.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        this._view.webview.html = this.getHtmlForWebview(this._view.webview);

        this._setWebviewMessageListener(this._view.webview);

    }
    private dispose() {
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }


    private getHtmlForWebview(webview: Webview) {
        const file = "src/main.tsx";
        const localPort = "5173";
        const localServerUrl = `localhost:${localPort}`;

        // The CSS file from the React build output
        const stylesUri = getUri(webview, this._extensionUri, [
            "webview-ui",
            "build",
            "assets",
            "index.css",
        ]);

        console.log(stylesUri);

        let scriptUri;
        const isProd = ExtensionContextUtil.getExtensionContext().isProduction;

        if (isProd) {
            scriptUri = getUri(webview, this._extensionUri, [
                "webview-ui",
                "build",
                "assets",
                "index.js",
            ])
        } else {
            scriptUri = `http://${localServerUrl}/${file}`;
        }

        const nonce = getNonce();

        // preamble for HMR
        const reactRefresh = /*html*/ `
        <script type="module">
          import RefreshRuntime from "http://localhost:5173/@react-refresh"
          RefreshRuntime.injectIntoGlobalHook(window)
          window.$RefreshReg$ = () => {}
          window.$RefreshSig$ = () => (type) => type
          window.__vite_plugin_react_preamble_installed__ = true
        </script>`;

        const reactRefreshHash =
            "sha256-YmMpkm5ow6h+lfI3ZRp0uys+EUCt6FOyLkJERkfVnTY=";

        const csp = [
            `default-src 'none';`,
            `script-src 'unsafe-eval' https://* ${isProd
                ? `'nonce-${nonce}'`
                : `http://${localServerUrl} http://0.0.0.0:${localPort} '${reactRefreshHash}'`
            }`,
            `style-src ${webview.cspSource} 'self' 'unsafe-inline' https://*`,
            `font-src ${webview.cspSource}`,
            `img-src ${webview.cspSource} https://* data:`,
            `connect-src https://* ${isProd
                ? ``
                : `ws://${localServerUrl} ws://0.0.0.0:${localPort} http://${localServerUrl} http://0.0.0.0:${localPort}`
            }`,
        ];

        return /*html*/ `<!DOCTYPE html>
      <html lang="en">
        <head>
          ${isProd ? "" : reactRefresh}
          <meta charset="UTF-8" />
          <meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <script type="module" src="http://${localServerUrl}/@vite/client"></script>
          <title>Submitty</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" src="${scriptUri}"></script>
        </body>
      </html>`;
    }

    private _setWebviewMessageListener(webview: Webview) {
        webview.onDidReceiveMessage(
            (message: any) => {
                const command = message.command
                const text = message.text

                switch (command) {
                    case "hello":
                        // Code that should run in response to the hello message command
                        window.showInformationMessage(text);
                        return;
                    // Add more switch case statements here as more webview message commands
                    // are created within the webview context (i.e. inside media/main.js)
                }
            },
            undefined,
            this._disposables
        );
    }
}

export default ReactWebview;
