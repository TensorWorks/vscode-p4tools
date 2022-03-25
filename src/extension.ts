/*---------------------------------------------------------
 * Copyright (C) TensorWorks Pty Ltd. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { P4Tools } from './p4tools';

export function activate(context: vscode.ExtensionContext) {
	
	const p4Tools = new P4Tools();

	// Custom commands
	context.subscriptions.push(vscode.commands.registerCommand("p4tools.statusBarClicked", p4Tools.statusBarClicked, p4Tools));
	context.subscriptions.push(vscode.commands.registerCommand("p4tools.checkoutFile", p4Tools.p4CheckOutFile, p4Tools));

	// Custom UI
	context.subscriptions.push(p4Tools.getStatusBarItem());
	
	// Add a callback for when a file "will be saved" - we use this for showing a checkout option.
	vscode.workspace.onWillSaveTextDocument(p4Tools.interceptReadonlySaveAndCheckout, p4Tools);

}
