#!/usr/bin/env node
import { cli } from "cleye";
import aicommits from "./commands/aicommits.js";
import configCommand from "./commands/config.js";
import pkg from "../package.json";

// Get raw arguments for passing to git commit
const rawArgv = process.argv.slice(2);

// Create the CLI
cli(
	{
		name: "aicommits",
		version: pkg.version,

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
			"capitalize-message": {
				type: Boolean,
				description: "Capitalize the first letter of the commit message",
				alias: "c",
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
			description: pkg.description,
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
			// Set capitalize-message config if capitalize-message flag is provided
			argv.flags["capitalize-message"],
			// Pass debug flag
			argv.flags.debug,
			rawArgv,
		);
	},
	rawArgv,
);
