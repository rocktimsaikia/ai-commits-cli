import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ini from "ini";
import type { TiktokenModel } from "@dqbd/tiktoken";
import { KnownError } from "./error.js";

// Available commit types
const commitTypes = ["", "conventional"] as const;
export type CommitType = (typeof commitTypes)[number];

// Default configuration values
const DEFAULT_CONFIG = {
	model: "gpt-3.5-turbo" as TiktokenModel,
	locale: "en",
	generate: 1,
	timeout: 10000,
	"max-length": 50,
	type: "" as CommitType,
	"use-branch-prefix": false,
};

/**
 * Check if an object has a property
 */
export const hasOwn = (object: unknown, key: PropertyKey) =>
	Object.hasOwnProperty.call(object, key);

/**
 * Assert a condition and throw a user-friendly error if it fails
 */
const parseAssert = (name: string, condition: boolean, message: string) => {
	if (!condition) {
		throw new KnownError(`Invalid config property ${name}: ${message}`);
	}
};

/**
 * Configuration parsers for validating and transforming user input
 */
const configParsers = {
	OPENAI_KEY(key?: string) {
		if (!key) {
			throw new KnownError(
				"Please set your OpenAI API key via `aicommits config set OPENAI_KEY=<your token>`",
			);
		}
		parseAssert("OPENAI_KEY", key.startsWith("sk-"), 'Must start with "sk-"');
		return key;
	},

	locale(locale?: string) {
		if (!locale) {
			return DEFAULT_CONFIG.locale;
		}

		parseAssert("locale", Boolean(locale), "Cannot be empty");
		parseAssert(
			"locale",
			/^[a-z-]+$/i.test(locale),
			"Must be a valid locale (letters and dashes/underscores). See: https://wikipedia.org/wiki/List_of_ISO_639-1_codes",
		);
		return locale;
	},

	generate(count?: string) {
		if (!count) {
			return DEFAULT_CONFIG.generate;
		}

		parseAssert("generate", /^\d+$/.test(count), "Must be an integer");

		const parsed = Number(count);
		parseAssert("generate", parsed > 0, "Must be greater than 0");
		parseAssert("generate", parsed <= 5, "Must be less or equal to 5");

		return parsed;
	},

	type(type?: string) {
		if (!type) {
			return DEFAULT_CONFIG.type;
		}

		parseAssert("type", commitTypes.includes(type as CommitType), "Invalid commit type");
		return type as CommitType;
	},

	proxy(url?: string) {
		if (!url || url.length === 0) {
			return undefined;
		}

		parseAssert("proxy", /^https?:\/\//.test(url), "Must be a valid URL");
		return url;
	},

	model(model?: string) {
		if (!model || model.length === 0) {
			return DEFAULT_CONFIG.model;
		}
		return model as TiktokenModel;
	},

	timeout(timeout?: string) {
		if (!timeout) {
			return DEFAULT_CONFIG.timeout;
		}

		parseAssert("timeout", /^\d+$/.test(timeout), "Must be an integer");

		const parsed = Number(timeout);
		parseAssert("timeout", parsed >= 500, "Must be greater than 500ms");
		return parsed;
	},

	"max-length"(maxLength?: string) {
		if (!maxLength) {
			return DEFAULT_CONFIG["max-length"];
		}

		parseAssert("max-length", /^\d+$/.test(maxLength), "Must be an integer");

		const parsed = Number(maxLength);
		parseAssert("max-length", parsed >= 20, "Must be greater than 20 characters");
		return parsed;
	},

	"use-branch-prefix"(value?: string) {
		// If no value is provided, return default
		if (value === undefined || value === null || value === "") {
			return DEFAULT_CONFIG["use-branch-prefix"];
		}

		// Handle common string representations of boolean values
		const lowerValue = String(value).toLowerCase().trim();

		// Accept various forms of true/false values
		if (["true", "1", "yes", "y", "on"].includes(lowerValue)) {
			return true;
		}

		if (["false", "0", "no", "n", "off"].includes(lowerValue)) {
			return false;
		}

		// If we get here, it's an invalid value
		parseAssert("use-branch-prefix", false, "Must be either 'true' or 'false'");

		// This won't be reached due to the assert above, but TypeScript needs it
		return DEFAULT_CONFIG["use-branch-prefix"];
	},
} as const;

// Type definitions for configuration
type ConfigKeys = keyof typeof configParsers;

type RawConfig = {
	[key in ConfigKeys]?: string;
};

export type ValidConfig = {
	[Key in ConfigKeys]: ReturnType<(typeof configParsers)[Key]>;
};

/**
 * Check if a file exists (works for files, directories, and symlinks)
 *
 * @param filePath Path to the file to check
 * @returns Promise that resolves to true if the file exists, false otherwise
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
	try {
		await fs.lstat(filePath);
		return true;
	} catch {
		return false;
	}
};

// Path to the config file in the user's home directory
const configPath = path.join(os.homedir(), ".aicommits");

/**
 * Read the configuration file from disk
 */
const readConfigFile = async (): Promise<RawConfig> => {
	const configExists = await fileExists(configPath);
	if (!configExists) {
		return {};
	}

	try {
		const configString = await fs.readFile(configPath, "utf8");
		const parsed = ini.parse(configString);

		// Direct fix: Check if use-branch-prefix is in the config file
		// and ensure it's properly parsed as a boolean
		if (parsed["use-branch-prefix"] !== undefined) {
			const value = String(parsed["use-branch-prefix"])
				.toLowerCase()
				.trim();

			// Convert to proper boolean
			if (["true", "1", "yes", "y", "on"].includes(value)) {
				parsed["use-branch-prefix"] = "true";
			}
		}

		return parsed;
	} catch (error) {
		console.error("Error reading config file:", error);
		return {};
	}
};

/**
 * Get the validated configuration, merging file config with CLI options
 */
export const getConfig = async (
	cliConfig?: RawConfig,
	suppressErrors = false,
): Promise<ValidConfig> => {
	const config = await readConfigFile();
	const parsedConfig: Record<string, unknown> = {};

	for (const key of Object.keys(configParsers) as ConfigKeys[]) {
		const parser = configParsers[key];

		// Special handling for use-branch-prefix
		// If it's explicitly set in the file config, it should take precedence
		let value: string | undefined;
		if (key === "use-branch-prefix" && config[key] === "true") {
			value = config[key];
		} else {
			value = cliConfig?.[key] ?? config[key];
		}

		if (suppressErrors) {
			try {
				const result = parser(value);
				parsedConfig[key] = result;
			} catch (error) {
				// Use default value if available
				if (key in DEFAULT_CONFIG) {
					// Use type assertion with Record to avoid any
					const defaultValue = (DEFAULT_CONFIG as Record<string, unknown>)[key];
					parsedConfig[key] = defaultValue;
				}
			}
		} else {
			const result = parser(value);
			parsedConfig[key] = result;
		}
	}

	return parsedConfig as ValidConfig;
};

/**
 * Save configuration values to the config file
 */
export const setConfigs = async (keyValues: [key: string, value: string][]) => {
	const config = await readConfigFile();

	for (const [key, value] of keyValues) {
		if (!hasOwn(configParsers, key)) {
			throw new KnownError(`Invalid config property: ${key}`);
		}

		try {
			const parsed = configParsers[key as ConfigKeys](value);
			// Handle boolean values specially to ensure they're saved as 'true'/'false'
			if (typeof parsed === "boolean") {
				config[key as ConfigKeys] = parsed ? "true" : "false";
			} else {
				config[key as ConfigKeys] = String(parsed);
			}
		} catch (error) {
			if (error instanceof KnownError) {
				throw error;
			}
			throw new KnownError(`Error setting ${key}: ${(error as Error).message}`);
		}
	}

	try {
		await fs.writeFile(configPath, ini.stringify(config), "utf8");
	} catch (error) {
		throw new KnownError(`Failed to save config: ${(error as Error).message}`);
	}
};
