#!/usr/bin/env node
/**
 * Main CLI entry point for aicommits
 *
 * This tool uses AI to generate commit messages based on your staged changes.
 */
import { cli } from "cleye";
import fs from "node:fs";
import path from "node:path";
import aicommits from "./commands/aicommits.js";
import configCommand from "./commands/config.js";

// Read package.json dynamically to avoid TypeScript import issues
const pkgPath = path.resolve(process.cwd(), "package.json");
const pkgContent = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const { description, version } = pkgContent;

// Get raw arguments for passing to git commit
const rawArgv = process.argv.slice(2);

// Create the CLI
cli(
	{
		name: "aicommits",
		version,

		/**
		 * Since this is a wrapper around `git commit`,
		 * flags should not overlap with it
		 * https://git-scm.com/docs/git-commit
		 */
		flags: {
			generate: {
				type: Number,
				description: "Number of messages to generate (1-5)",
				alias: "g",
			},
			exclude: {
				type: String,
				description: "Files to exclude from AI analysis",
				alias: "x",
				multiple: true,
			},
			all: {
				type: Boolean,
				description: "Automatically stage changes in tracked files",
				alias: "a",
				default: false,
			},
			type: {
				type: String,
				description: "Type of commit message to generate",
				alias: "t",
			},
			"branch-prefix": {
				type: Boolean,
				description: "Use current branch name as commit message prefix",
				alias: "b",
				default: false,
			},
			debug: {
				type: Boolean,
				description: "Show debug information",
				default: false,
			},
		},

		commands: [configCommand],

		help: {
			description,
		},

		// Ignore unknown flags and arguments (pass them to git commit)
		ignoreArgv: (type) => type === "unknown-flag" || type === "argument",
	},
	// Command handler
	(argv) => {
		// Generate commit message
		aicommits(
			argv.flags.generate,
			// Ensure exclude is always an array
			Array.isArray(argv.flags.exclude) ? argv.flags.exclude : [],
			argv.flags.all,
			argv.flags.type,
			// Set use-branch-prefix config if branch-prefix flag is provided
			argv.flags["branch-prefix"],
			// Pass debug flag
			argv.flags.debug,
			rawArgv,
		);
	},
	rawArgv,
);
