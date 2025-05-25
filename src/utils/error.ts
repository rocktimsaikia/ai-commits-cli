import { dim } from "kolorist";
import fs from "node:fs";
import path from "node:path";

// Read version from package.json
const pkgPath = path.resolve(process.cwd(), "package.json");
const { version } = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

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
		console.error(`\n${indent}${dim(`aicommits v${version}`)}`);
		console.error(`\n${indent}Please report this issue with the information above.`);
	}
};
