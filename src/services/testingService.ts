import * as vscode from 'vscode';
import { ApiService } from './apiService';
import type { AutoGraderDetailsData, TestCase } from '../interfaces/AutoGraderDetails';

const CONTROLLER_ID = 'submittyAutograder';
const CONTROLLER_LABEL = 'Submitty Autograder';
const ROOT_ID = 'submitty-root';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 300000; // 5 min

interface GradeableMeta {
    term: string;
    courseId: string;
    gradeableId: string;
}

export class TestingService {
    private controller: vscode.TestController;
    private rootItem: vscode.TestItem;
    private gradeableMeta = new WeakMap<vscode.TestItem, GradeableMeta>();
    private testCaseMeta = new WeakMap<vscode.TestItem, TestCase>();

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly apiService: ApiService
    ) {
        this.controller = vscode.tests.createTestController(CONTROLLER_ID, CONTROLLER_LABEL);
        this.rootItem = this.controller.createTestItem(ROOT_ID, 'Submitty', undefined);
        this.rootItem.canResolveChildren = true;
        this.controller.items.add(this.rootItem);

        this.controller.resolveHandler = async (item) => this.resolveHandler(item);
        const runProfile = this.controller.createRunProfile(
            'Run',
            vscode.TestRunProfileKind.Run,
            (request, token) => this.runHandler(request, token)
        );
        runProfile.isDefault = true;

        context.subscriptions.push(this.controller);
    }

    /**
     * Add a gradeable to the Test Explorer so the user can run it and see results.
     * Call this when the user triggers "Grade" or "Run autograder" for a gradeable.
     */
    addGradeable(term: string, courseId: string, gradeableId: string, label: string): vscode.TestItem {
        const id = `${term}/${courseId}/${gradeableId}`;
        let item = this.rootItem.children.get(id);
        if (!item) {
            item = this.controller.createTestItem(id, label, undefined);
            item.canResolveChildren = true;
            this.gradeableMeta.set(item, { term, courseId, gradeableId });
            this.rootItem.children.add(item);
        }
        return item;
    }

    private getGradeableMeta(item: vscode.TestItem): GradeableMeta | undefined {
        return this.gradeableMeta.get(item);
    }

    private async resolveHandler(item: vscode.TestItem | undefined): Promise<void> {
        if (!item) {
            return;
        }
        const meta = this.getGradeableMeta(item);
        if (!meta) {
            return;
        }
        // Resolve: poll until complete and populate children (test cases)
        try {
            const result = await this.apiService.pollGradeDetailsUntilComplete(
                meta.term,
                meta.courseId,
                meta.gradeableId,
                { intervalMs: POLL_INTERVAL_MS, timeoutMs: POLL_TIMEOUT_MS }
            );
            this.syncTestCaseChildren(item, result.data);
        } catch (e) {
            console.error('Submitty testing resolve failed:', e);
        }
    }

    private syncTestCaseChildren(gradeableItem: vscode.TestItem, data: AutoGraderDetailsData): void {
        const cases = data.test_cases ?? [];
        for (let i = 0; i < cases.length; i++) {
            const tc = cases[i];
            const id = `tc-${i}-${tc.name ?? i}`;
            let child = gradeableItem.children.get(id);
            if (!child) {
                child = this.controller.createTestItem(id, tc.name || `Test ${i + 1}`, undefined);
                this.testCaseMeta.set(child, tc);
                gradeableItem.children.add(child);
            } else {
                this.testCaseMeta.set(child, tc);
            }
        }
    }

    private async runHandler(request: vscode.TestRunRequest, token: vscode.CancellationToken): Promise<void> {
        const run = this.controller.createTestRun(request);
        const queue: vscode.TestItem[] = [];

        if (request.include) {
            request.include.forEach((t) => {
                if (t.id === ROOT_ID) {
                    this.rootItem.children.forEach((c) => queue.push(c));
                } else {
                    queue.push(t);
                }
            });
        } else {
            this.rootItem.children.forEach((t) => queue.push(t));
        }

        while (queue.length > 0 && !token.isCancellationRequested) {
            const item = queue.shift()!;
            if (request.exclude?.includes(item)) {
                continue;
            }

            const meta = this.getGradeableMeta(item);
            if (!meta) {
                continue;
            }

            run.started(item);
            run.appendOutput(`Polling grade details for ${item.label}...\r\n`);

            try {
                const result = await this.apiService.pollGradeDetailsUntilComplete(
                    meta.term,
                    meta.courseId,
                    meta.gradeableId,
                    { intervalMs: POLL_INTERVAL_MS, timeoutMs: POLL_TIMEOUT_MS, token }
                );
                const data = result.data;
                this.syncTestCaseChildren(item, data);

                let allPassed = true;
                const start = Date.now();
                item.children.forEach((child) => {
                    const tc = this.testCaseMeta.get(child);
                    run.started(child);
                    if (tc) {
                        const passed = tc.points_received >= (tc.points_available ?? 0);
                        if (!passed) {
                            allPassed = false;
                        }
                        const duration = Date.now() - start;
                        const message = [tc.testcase_message, tc.details].filter(Boolean).join('\n') || undefined;
                        if (passed) {
                            run.passed(child, duration);
                        } else {
                            run.failed(child, new vscode.TestMessage(message || 'Failed'), duration);
                        }
                    } else {
                        run.passed(child, 0);
                    }
                });

                if (item.children.size === 0) {
                    run.appendOutput(`No test cases in response.\r\n`);
                    run.failed(item, new vscode.TestMessage('No test cases returned.'), 0);
                } else {
                    if (allPassed) {
                        run.passed(item, Date.now() - start);
                    } else {
                        run.failed(item, new vscode.TestMessage('Some test cases failed.'), Date.now() - start);
                    }
                }
            } catch (e) {
                const err = e instanceof Error ? e.message : String(e);
                run.appendOutput(`Error: ${err}\r\n`);
                run.failed(item, new vscode.TestMessage(err), 0);
            }
        }

        run.end();
    }
}
