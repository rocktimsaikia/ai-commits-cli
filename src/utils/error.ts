import { dim } from "kolorist";
import pkg from "../../package.json";

/**
 * Custom error class for known errors that should be displayed to the user
 * without a stack trace or additional debugging information
 */
export class KnownError extends Error {}

/**
 * Handle CLI errors, displaying appropriate information to the user
 *
 * @param error The error to handle
 */
export const handleCliError = (error: Error) => {
	// Only show detailed error info for unknown errors
	if (error instanceof Error && !(error instanceof KnownError)) {
		const indent = "    ";

		// Show stack trace for debugging
		if (error.stack) {
			console.error(dim(error.stack.split("\n").slice(1).join("\n")));
		}

		// Show version and issue reporting info
		console.error(`\n${indent}${dim(`aicommits v${pkg.version}`)}`);
		console.error(`\n${indent}Please report this issue with the information above.`);
	}
};
