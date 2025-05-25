import { Configuration, OpenAIApi } from "openai";
import type { TiktokenModel } from "@dqbd/tiktoken";
import type { CommitType } from "./config.js";
import { KnownError } from "./error.js";
import { generatePrompt } from "./prompt.js";

/**
 * Get an OpenAI client instance
 *
 * @param apiKey OpenAI API key
 * @param proxy Optional proxy URL
 * @returns OpenAI API client
 */
const getOpenAIClient = (apiKey: string, proxy?: string) => {
	// Set proxy if provided
	if (proxy) {
		process.env.HTTPS_PROXY = proxy;
	}

	// Create and return a new client
	const configuration = new Configuration({ apiKey });
	return new OpenAIApi(configuration);
};

/**
 * Sanitize a commit message by removing newlines and trailing periods
 */
const sanitizeMessage = (message: string) =>
	message
		.trim()
		.replace(/[\n\r]/g, "")
		.replace(/(\w)\.$/, "$1");

/**
 * Remove duplicate messages from an array
 */
const deduplicateMessages = (array: string[]) => Array.from(new Set(array));

/**
 * Generate commit messages using OpenAI API
 *
 * @param apiKey OpenAI API key
 * @param model Model to use for generation
 * @param locale Language for the commit message
 * @param diff Git diff to analyze
 * @param completions Number of commit messages to generate
 * @param maxLength Maximum length of commit messages
 * @param type Type of commit message format
 * @param timeout API request timeout in milliseconds
 * @param proxy Optional proxy URL
 * @returns Array of generated commit messages
 */
export const generateCommitMessage = async (
	apiKey: string,
	model: TiktokenModel,
	locale: string,
	diff: string,
	completions: number,
	maxLength: number,
	type: CommitType,
	timeout: number,
	proxy?: string,
): Promise<string[]> => {
	try {
		const client = getOpenAIClient(apiKey, proxy);

		const response = await client.createChatCompletion(
			{
				model,
				messages: [
					{
						role: "system",
						content: generatePrompt(locale, maxLength, type),
					},
					{
						role: "user",
						content: diff,
					},
				],
				temperature: 0.7,
				top_p: 1,
				max_tokens: 200,
				n: completions,
			},
			{ timeout },
		);

		return deduplicateMessages(
			(response.data.choices || [])
				.filter((choice) => choice.message?.content)
				.map((choice) => sanitizeMessage(choice.message?.content || "")),
		);
	} catch (error) {
		// Handle common API errors
		const err = error as Error & {
			code?: string;
			response?: {
				status: number;
				statusText: string;
				data?: { error?: { message: string } };
			};
		};

		// Handle network errors
		if (err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
			throw new KnownError(
				"Error connecting to OpenAI API. Check your internet connection.",
			);
		}

		// Handle OpenAI API errors
		if (err.response?.status) {
			const errorMessage =
				err.response.data?.error?.message ||
				`OpenAI API Error: ${err.response.status} - ${err.response.statusText}`;
			throw new KnownError(errorMessage);
		}

		// Rethrow unknown errors
		throw err;
	}
};
