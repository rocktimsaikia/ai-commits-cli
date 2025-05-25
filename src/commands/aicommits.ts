import { execa } from "execa";
import { black, dim, green, red, bgCyan } from "kolorist";
import { intro, outro, spinner, select, confirm, isCancel } from "@clack/prompts";
import {
	assertGitRepo,
	getStagedDiff,
	getDetectedMessage,
	getCurrentBranch,
} from "../utils/git.js";
import { getConfig } from "../utils/config.js";
import { generateCommitMessage } from "../utils/openai.js";
import { KnownError, handleCliError } from "../utils/error.js";
import clipboardy from "clipboardy";

/**
 * Command options for aicommits
 */
type AicommitsOptions = {
	generate?: number;
	excludeFiles: string[];
	stageAll: boolean;
	commitType?: string;
	useBranchPrefix?: boolean;
	debug?: boolean;
	rawArgv: string[];
};

/**
 * Stage all changes if requested
 */
async function stageAllChanges(): Promise<void> {
	// This should be equivalent behavior to `git commit --all`
	await execa("git", ["add", "--update"]);
}

/**
 * Get staged changes and display information to the user
 */
async function getStagedChanges(
	excludeFiles: string[],
): Promise<{ files: string[]; diff: string }> {
	const detectingFiles = spinner();
	detectingFiles.start("Detecting staged files");

	try {
		const staged = await getStagedDiff(excludeFiles);

		if (!staged) {
			throw new KnownError(
				"No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag.",
			);
		}

		// Display the detected files
		detectingFiles.stop(
			`${getDetectedMessage(staged.files)}:\n${staged.files
				.map((file) => `     ${file}`)
				.join("\n")}`,
		);

		return staged;
	} catch (error) {
		detectingFiles.stop("Error detecting staged files");
		throw error;
	}
}

/**
 * Load configuration and environment variables
 */
async function loadConfig(
	options: Pick<AicommitsOptions, "generate" | "commitType" | "useBranchPrefix">,
): Promise<ReturnType<typeof getConfig>> {
	const { env } = process;

	return getConfig({
		OPENAI_KEY: env.OPENAI_KEY || env.OPENAI_API_KEY,
		proxy: env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
		generate: options.generate?.toString(),
		type: options.commitType?.toString(),
		"use-branch-prefix":
			options.useBranchPrefix !== undefined ? String(options.useBranchPrefix) : undefined,
	});
}

/**
 * Generate commit messages using OpenAI
 */
async function generateMessages(
	config: Awaited<ReturnType<typeof getConfig>>,
	diff: string,
): Promise<string[]> {
	const s = spinner();
	s.start("The AI is analyzing your changes");

	try {
		const messages = await generateCommitMessage(
			config.OPENAI_KEY,
			config.model,
			config.locale,
			diff,
			config.generate,
			config["max-length"],
			config.type,
			config.timeout,
			config.proxy,
		);

		if (messages.length === 0) {
			throw new KnownError("No commit messages were generated. Try again.");
		}

		return messages;
	} finally {
		s.stop("Changes analyzed");
	}
}

/**
 * Let the user select a commit message
 */
async function selectCommitMessage(messages: string[]): Promise<string | null> {
	// If there's only one message, ask for confirmation
	if (messages.length === 1) {
		const [message] = messages;
		const confirmed = await confirm({
			message: `Use this commit message?\n\n   ${message}\n`,
		});

		if (!confirmed || isCancel(confirmed)) {
			return null;
		}

		return message;
	}

	// If there are multiple messages, let the user select one
	const selected = await select({
		message: `Pick a commit message to use: ${dim("(Ctrl+c to exit)")}`,
		options: messages.map((value) => ({ label: value, value })),
	});

	if (isCancel(selected)) {
		return null;
	}

	return selected as string;
}

/**
 * Apply branch prefix to a commit message if enabled
 */
async function applyBranchPrefix(
	message: string,
	useBranchPrefix: boolean,
	debug?: boolean,
): Promise<string> {
	// Create a debug info string to display later
	const debugInfo = [];

	if (!useBranchPrefix) {
		return message;
	}

	try {
		// Get the current branch name
		const branchName = await getCurrentBranch();

		// Extract ticket ID or clean branch name
		const ticketIdMatch = branchName.match(/([A-Z]+-\d+)/i);
		let prefix: string;

		if (ticketIdMatch) {
			prefix = ticketIdMatch[0].toUpperCase();
		} else {
			// Clean the branch name to get a meaningful prefix
			prefix = branchName
				.replace(/^(feature|fix|bugfix|hotfix|release|chore)\//, "") // Remove common prefixes
				.replace(/[-_]/g, " ") // Replace dashes and underscores with spaces
				.replace(/\s+/g, " ") // Replace multiple spaces with a single space
				.trim();
		}

		// Format the prefix
		const finalMessage = `${prefix}: ${message}`;

		// Display debug info only if debug mode is enabled
		if (debug) {
			console.log("\n--- BRANCH PREFIX DEBUG INFO ---");
			console.log(`Current branch: ${branchName}`);
			console.log(`Prefix: ${prefix}`);
			console.log(`Final message: ${finalMessage}`);
			console.log("-------------------------------\n");
		}

		return finalMessage;
	} catch (error) {
		// If there's an error, return the original message
		if (debug) {
			console.error("Error applying branch prefix:", error);
		}
		return message;
	}
}

/**
 * Create the commit with the selected message
 */
async function createCommit(
	message: string,
	rawArgv: string[],
	useBranchPrefix: boolean,
	debug?: boolean,
): Promise<void> {
	// The message may already have the branch prefix applied
	// Only apply it if useBranchPrefix is true
	const finalMessage = useBranchPrefix
		? await applyBranchPrefix(message, true, debug)
		: message;

	// Copy the selected message to clipboard
	let clipboardSuccess = false;
	try {
		// Make sure we're using the write method correctly
		await clipboardy.write(finalMessage);
		clipboardSuccess = true;
	} catch (error) {
		console.error("Failed to copy to clipboard:", error);
	}

	await execa("git", ["commit", "-n", "-m", finalMessage, ...rawArgv]);

	if (clipboardSuccess) {
		outro(
			`${green("✔")} Successfully committed! ${dim(
				"(Commit message copied to clipboard)",
			)}`,
		);
	} else {
		outro(`${green("✔")} Successfully committed!`);
	}
}

/**
 * Main aicommits command handler
 */
async function aicommitsHandler({
	generate,
	excludeFiles,
	stageAll,
	commitType,
	useBranchPrefix,
	debug,
	rawArgv,
}: AicommitsOptions): Promise<void> {
	try {
		// Initialize and show welcome message
		intro(bgCyan(black(" aicommits ")));

		// Verify we're in a git repository
		await assertGitRepo();

		// Stage all changes if requested
		if (stageAll) {
			await stageAllChanges();
		}

		// Get staged changes
		const staged = await getStagedChanges(excludeFiles);

		// Load configuration
		const config = await loadConfig({ generate, commitType, useBranchPrefix });

		// Only show debug information if explicitly enabled
		if (debug) {
			console.log("\n--- CONFIG DEBUG INFO ---");
			console.log("Configuration:", config);
			console.log("Branch prefix enabled:", Boolean(config["use-branch-prefix"]));
			console.log("-------------------------\n");
		}

		// IMPORTANT: Check if branch prefix is enabled in config file directly
		if (useBranchPrefix || config["use-branch-prefix"]) {
			config["use-branch-prefix"] = true;
		}

		// Generate commit messages
		let messages = await generateMessages(config, staged.diff);

		// Apply branch prefix to all messages if enabled
		if (config["use-branch-prefix"]) {
			// Apply branch prefix to each message
			const prefixedMessages = [];
			for (const msg of messages) {
				prefixedMessages.push(await applyBranchPrefix(msg, true, debug));
			}
			messages = prefixedMessages;
		}

		// Let the user select a commit message
		const selectedMessage = await selectCommitMessage(messages);

		if (!selectedMessage) {
			outro("Commit cancelled");
			return;
		}

		// Create the commit (don't apply branch prefix again since it's already applied)
		await createCommit(selectedMessage, rawArgv, false, debug);
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		outro(`${red("✖")} ${err.message}`);
		handleCliError(err); // Pass the converted error
		process.exit(1);
	}
}

/**
 * Default export for backward compatibility with the existing code
 */
const aicommits = async (
	generate: number | undefined,
	excludeFiles: string[],
	stageAll: boolean,
	commitType: string | undefined,
	useBranchPrefix: boolean | undefined,
	debug: boolean | undefined,
	rawArgv: string[],
): Promise<void> =>
	aicommitsHandler({
		generate,
		excludeFiles,
		stageAll,
		commitType,
		useBranchPrefix,
		debug,
		rawArgv,
	});

export default aicommits;
