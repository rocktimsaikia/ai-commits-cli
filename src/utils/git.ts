import { execa } from "execa";
import { KnownError } from "./error.js";

/**
 * Verify that the current directory is a Git repository
 *
 * @returns The path to the root of the Git repository
 * @throws {KnownError} If the current directory is not a Git repository
 */
export const assertGitRepo = async (): Promise<string> => {
	try {
		const { stdout, failed } = await execa("git", ["rev-parse", "--show-toplevel"], {
			reject: false,
		});

		if (failed) {
			throw new KnownError("The current directory must be a Git repository!");
		}

		return stdout;
	} catch (error) {
		// Handle case where git is not installed
		if (error instanceof Error && error.message.includes("command not found")) {
			throw new KnownError("Git is not installed or not available in PATH");
		}
		throw error;
	}
};

/**
 * Format a path to be excluded from git diff
 *
 * @param path Path to exclude
 * @returns Formatted exclude path for git command
 */
const excludeFromDiff = (path: string): string => `:(exclude)${path}`;

/**
 * Default files to exclude from diff analysis
 * These files typically contain auto-generated content that's not useful for commit messages
 */
const filesToExclude = [
	// Package manager lock files
	"package-lock.json",
	"pnpm-lock.yaml",
	"yarn.lock",
	"*.lock",
	// Build outputs
	"dist/**",
	"build/**",
].map(excludeFromDiff);

/**
 * Get the staged diff from git
 *
 * @param excludeFiles Optional array of files to exclude from the diff
 * @returns Object containing the list of staged files and the diff content, or undefined if no files are staged
 */
export const getStagedDiff = async (
	excludeFiles?: string[],
): Promise<{ files: string[]; diff: string } | undefined> => {
	try {
		// Common diff options
		const diffCached = ["diff", "--cached", "--diff-algorithm=minimal"];

		// Additional exclude patterns from user input
		const userExcludes = excludeFiles ? excludeFiles.map(excludeFromDiff) : [];

		// Get list of staged files
		const { stdout: files } = await execa("git", [
			...diffCached,
			"--name-only",
			...filesToExclude,
			...userExcludes,
		]);

		// If no files are staged, return undefined
		if (!files.trim()) {
			return undefined;
		}

		// Get the actual diff content
		const { stdout: diff } = await execa("git", [
			...diffCached,
			...filesToExclude,
			...userExcludes,
		]);

		return {
			files: files.split("\n").filter(Boolean), // Filter out empty strings
			diff,
		};
	} catch (error) {
		if (error instanceof Error) {
			throw new KnownError(`Failed to get staged changes: ${error.message}`);
		}
		throw error;
	}
};

/**
 * Generate a human-readable message about the number of detected files
 *
 * @param files Array of file paths
 * @returns Formatted message string
 */
export const getDetectedMessage = (files: string[]): string =>
	`Detected ${files.length.toLocaleString()} staged file${files.length > 1 ? "s" : ""}`;

/**
 * Get the current branch name
 *
 * @returns The name of the current git branch
 * @throws {KnownError} If unable to get the branch name
 */
export const getCurrentBranch = async (): Promise<string> => {
	try {
		const { stdout } = await execa("git", ["branch", "--show-current"]);
		return stdout.trim();
	} catch (error) {
		if (error instanceof Error) {
			throw new KnownError(`Failed to get current branch: ${error.message}`);
		}
		throw error;
	}
};
