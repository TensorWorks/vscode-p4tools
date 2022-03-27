/*---------------------------------------------------------
 * Copyright (C) TensorWorks Pty Ltd. All rights reserved.
 *--------------------------------------------------------*/

import * as fs from "fs";
import * as vscode from 'vscode';
import * as child from 'child_process';

export class P4Tools {

	private p4StatusBarItem: vscode.StatusBarItem;
	private isExtensionIntialised = false;
	private p4User = "$(alert) Not logged in";
	private p4Workspace = "$(alert) Not in a workspace";
	private isRunningP4Command = false;

	constructor() {
		// A custom flag we use in some of our "when" contexts for this extension.
		vscode.commands.executeCommand('setContext', 'p4tools.initialised', this.isExtensionIntialised);
		
		// Setup status bar item
		this.p4StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.setupStatusBarItem(this.p4StatusBarItem);

		// Get the P4 user and workspace for our extension to actually do P4 things we need these
		this.updateP4UserAndWorkspace();
	}

	/* --------------------------- PRIVATE FUNCTIONS -------------------------- */

	private async updateP4UserAndWorkspace() {

		try {
			this.p4User = await this.p4GetLoggedInUser();
			this.p4Workspace = await this.findP4WorkspaceThatMatchesVSWorkspace(this.p4User);
			await this.p4RunCommand(`set P4CLIENT=${this.p4Workspace}`);
			this.isExtensionIntialised = true;
			vscode.commands.executeCommand('setContext', 'p4tools.initialised', this.isExtensionIntialised);
		}catch(err) {
			console.error("Could not generate status | " + err);
		}
		this.updateStatusBar();
	}

	private async findP4WorkspaceThatMatchesVSWorkspace(p4User : string) : Promise<string> {

		const p4WorkspacesMap = await this.p4GetAllWorkspaces(p4User);
	
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
	
	private async p4GetAllWorkspaces(p4User : string) : Promise<Map<string, string>> {
		const p4Command = `clients -u ${p4User}`;
		return this.p4RunCommand(p4Command).then(p4Output => {
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
	
	private async p4GetLoggedInUser() : Promise<string> {
		return this.p4RunCommand("login -s").then(loginMsg => {
			if(loginMsg.startsWith("User")){
				const tokens = loginMsg.split(" ");
				return tokens[1];
			}
			return "Unknown user";
		});
	}

	private setupStatusBarItem(statusBarItem : vscode.StatusBarItem) {
		// create a new status bar item that we can now manage
		statusBarItem.command = "p4tools.statusBarClicked";
		statusBarItem.text = `P4 (initialising...)`;
		statusBarItem.show();
	}

	private updateStatusBar() {
		const statusText = `P4 (${this.p4User})[${this.p4Workspace}]${this.isRunningP4Command ? ' - P4 work...' : ''}`;
		this.p4StatusBarItem.text = statusText;
	}

	private setIsRunningP4Command(isRunningP4Command : boolean) {
		this.isRunningP4Command = isRunningP4Command;
		this.updateStatusBar();
	}

	private isReadOnly(doc: vscode.TextDocument): boolean {
		const filePath = doc.fileName;
		try {
			fs.accessSync(filePath, fs.constants.W_OK);
			return false;
		} catch (error) {
			return true;
		}
	}

	/* --------------------------- PUBLIC FUNCTIONS -------------------------- */

	public getStatusBarItem() {
		return this.p4StatusBarItem;
	}

	public statusBarClicked() {
		console.log("Status bar clicked");
	}

	public interceptReadonlySaveAndCheckout(willSaveEvent: vscode.TextDocumentWillSaveEvent) {
		if(!this.isExtensionIntialised) {
			return;
		}
	
		const document = willSaveEvent.document;
		const readOnly = this.isReadOnly(document);
	
		if(!readOnly){
			return;
		}
	
		const filePath = document.fileName;
		const fileName = filePath.replace(/^.*[\\]/, '');
		const checkOutAndSaveOption = "Check Out & Save";
		const cancelOption = "Cancel";
	
		vscode.window.showInformationMessage(`Check Out & Save: '${fileName}'`, checkOutAndSaveOption, cancelOption).then((selection) =>{
			if(selection == checkOutAndSaveOption){
				const fileUri = vscode.Uri.file(filePath);
				// check out
				this.p4CheckOutFile(fileUri, "default").then(function(){
					// save the file
					document.save();
				});
			}
			else {
				// do nothing
				return;
			}
		});
	}

	public async p4CheckOutFile(fileUri : vscode.Uri, changelist = "default") {
		return this.p4RunCommand(`edit -c ${changelist} ${fileUri.fsPath}`);
	}

	public async p4RunCommand(p4Command : string) : Promise<string> {

		const cmdToExecute = `p4 ${p4Command}`;
	
		console.log(`Going to execute: ${cmdToExecute}`);
	
		return new Promise<string>((resolve, reject) => {
			
			// todo add setter for this
			this.setIsRunningP4Command(true);
	
			const foo: child.ChildProcess = child.exec(cmdToExecute, (error: child.ExecException | null, stdout: string, stderr: string) =>{
	
				this.setIsRunningP4Command(false);
	
				if(stderr){
					console.error(`P4 command error - ${stderr}`);
					vscode.window.showErrorMessage(stderr);
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

}