/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import * as child from 'child_process';

let p4StatusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
	
	// A custom flag we use in some of our "when" contexts for this extension.
	vscode.commands.executeCommand('setContext', 'p4tools.initialised', false);

	context.subscriptions.push(vscode.commands.registerCommand("p4tools.statusBarClicked", statusBarClicked));

	// create a new status bar item that we can now manage
	p4StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	p4StatusBarItem.command = "p4tools.statusBarClicked";
	p4StatusBarItem.text = `P4 (initialising...)`;
	p4StatusBarItem.show();
	context.subscriptions.push(p4StatusBarItem);

	context.subscriptions.push(vscode.commands.registerCommand("p4tools.checkoutFile",
		async (fileUri: vscode.Uri) => {
			return p4RunCommand(`edit ${fileUri.fsPath}`);
		}));


	generateStatusText().then(statusText => {
		p4StatusBarItem.text = statusText;
	});

}

export async function statusBarClicked() {
	console.log("Status bar clicked");
}

export async function generateStatusText() : Promise<string> {

	let p4User = "$(alert) Not logged in";
	let p4Workspace = "$(alert) Not in a workspace";

	try {
		p4User = await p4GetLoggedInUser();
		p4Workspace = await findP4WorkspaceThatMatchesVSWorkspace(p4User);
		await p4RunCommand(`set P4CLIENT=${p4Workspace}`);
		vscode.commands.executeCommand('setContext', 'p4tools.initialised', true);
	}catch(err) {
		console.error("Could not generate status | " + err);
	}
	
	return `P4 (${p4User})[${p4Workspace}] $(gear)`;
}

export async function findP4WorkspaceThatMatchesVSWorkspace(p4User : string) : Promise<string> {
	// let wf = vscode.workspace.workspaceFolders[0].uri.path ;
	

	const p4WorkspacesMap = await p4GetAllWorkspaces(p4User);

	return new Promise((resolve, reject) => {
		const wsFolders = vscode.workspace.workspaceFolders;
		if(wsFolders == undefined){
			reject("No VSCode workspace.");
		}
		else {
			for(const wsFolder of wsFolders) {
				for(const [workspaceName, workspacePath] of p4WorkspacesMap) {
					// hack that has consequence on linux
					const vsPath = wsFolder.uri.fsPath.toLowerCase();
					const p4Path = workspacePath.toLowerCase();
					if(vsPath.startsWith(p4Path)){
						resolve(workspaceName);
						return;
					}
				}
			}
			reject("Not in P4 workspace.");
		}
	});
}

export async function p4GetAllWorkspaces(p4User : string) : Promise<Map<string, string>> {
	const p4Command = `clients -u ${p4User}`;
	return p4RunCommand(p4Command).then(p4Output => {
		const linesArr = p4Output.split("\n").filter(value => value != null && value != '');
		const workspacesMap = new Map();
		for(const line of linesArr){
			const splitLine = line.split(" root ");
			const workspaceName = splitLine[0].split(" ")[1];
			const workspaceDir = splitLine[1].split(" 'Created by")[0];
			workspacesMap.set(workspaceName, workspaceDir);
		}
		return workspacesMap;
	});
}

export async function p4GetLoggedInUser() : Promise<string> {
	return p4RunCommand("login -s").then(loginMsg => {
		if(loginMsg.startsWith("User")){
			const tokens = loginMsg.split(" ");
			return tokens[1];
		}
		return "Unknown user";
	});
}

export async function p4RunCommand(p4Command : string) : Promise<string> {

	const cmdToExecute = `p4 ${p4Command}`;

	console.log(`Going to execute: ${cmdToExecute}`);

	return new Promise<string>((resolve, reject) => {
		const foo: child.ChildProcess = child.exec(cmdToExecute, function(error: child.ExecException | null, stdout: string, stderr: string){
			if(stderr){
				console.error(`P4 command error - ${stderr}`);
				reject(stderr);
				return;
			}
			if(stdout){
				console.log(`P4 command result - ${stdout}`);
				resolve(stdout);
				return;
			}
			resolve("");
		});
	});
}

// /**
//  * Provides code actions for converting :) to a smiley emoji.
//  */
// export class Emojizer implements vscode.CodeActionProvider {

// 	public static readonly providedCodeActionKinds = [
// 		vscode.CodeActionKind.QuickFix
// 	];

// 	public provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] | undefined {
		

// 		const extensionId = 'TensorWorks.uecpp';
// 		const extension = vscode.extensions.getExtension(extensionId);
// 		if(!extension){
// 			return;
// 		}

// 		const extensionPath = extension.extensionPath;

// 		const cTagsCommand = extensionPath + '\\ctags.exe -x --kinds-C++=* --language-force=c++ ' + document.fileName;

// 		const foo: child.ChildProcess = child.exec(cTagsCommand, function(error: child.ExecException | null, stdout: string, stderr: string){
//             if(stderr){
// 				console.error(stderr);
// 			}
// 			if(stdout){
// 				console.log(stdout);
// 			}
			
//         });
		
		
// 		if (!this.isAtStartOfSmiley(document, range)) {
// 			return;
// 		}

// 		const replaceWithSmileyCatFix = this.createFix(document, range, '😺');

// 		const replaceWithSmileyFix = this.createFix(document, range, '😀');
// 		// Marking a single fix as `preferred` means that users can apply it with a
// 		// single keyboard shortcut using the `Auto Fix` command.
// 		replaceWithSmileyFix.isPreferred = true;

// 		const replaceWithSmileyHankyFix = this.createFix(document, range, '💩');

// 		return [
// 			replaceWithSmileyCatFix,
// 			replaceWithSmileyFix,
// 			replaceWithSmileyHankyFix
// 		];
// 	}

// 	private isAtStartOfSmiley(document: vscode.TextDocument, range: vscode.Range) {
// 		const start = range.start;
// 		const line = document.lineAt(start.line);
// 		return line.text[start.character] === ':' && line.text[start.character + 1] === ')';
// 	}

// 	private createFix(document: vscode.TextDocument, range: vscode.Range, emoji: string): vscode.CodeAction {
// 		const fix = new vscode.CodeAction(`Convert to ${emoji}`, vscode.CodeActionKind.QuickFix);
// 		fix.edit = new vscode.WorkspaceEdit();
// 		fix.edit.replace(document.uri, new vscode.Range(range.start, range.start.translate(0, 2)), emoji);
// 		return fix;
// 	}
// }
