# AICommits

[![NPM Version](https://img.shields.io/npm/v/@rocktimsaikia/aicommits?color=brightgreen)](https://www.npmjs.com/package/@rocktimsaikia/aicommits)

> AI-powered git commit message generator in your terminal.

## Features
Originally a fork of [@Nutlope/aicommits](https://github.com/Nutlope/aicommits), this project underwent major refactoring to reduce bloat and focus solely on CLI functionality. Below are the unique features added, not present in the original project.

- 📋 Automatically copies the selected commit message to clipboard
- 🔖 Smart branch name prefixing (extracts Jira/Linear IDs)

## Installation

```bash
npm install -g @rocktimsaikia/aicommits
```

## Usage

> [!IMPORTANT]
> You'll need an OpenAI API key to use AICommits. You can get one from [OpenAI's website](https://platform.openai.com/account/api-keys).

Set up your API key:

```bash
# 1. Set the OpenAI API key (One-time):
aicommits config set OPENAI_KEY=your-api-key

# 2. Stage your changes with git:
git add .

# 3. Generate a commit message:
aicommits
# or use the shorthand (Recommended for quick usage)
aic
```

## Command Options

```bash
Options:
  -g, --generate <number>  Number of messages to generate (1-5)
  -x, --exclude <files>    Files to exclude from AI analysis
  -a, --all                Automatically stage changes in tracked files
  -t, --type <type>        Type of commit message to generate (conventional or empty)
  -b, --branch-prefix      Use current branch name as commit message prefix (auto-detects Jira/Linear IDs)
  --help                   Show this help message
  --version                Show version number
```

## Configuration

Customize AICommits with these configuration commands:

```bash
# Set the OpenAI API key
aicommits config set OPENAI_KEY=your-api-key

# Set the OpenAI model to use (default: gpt-3.5-turbo)
aicommits config set model=gpt-3.5-turbo

# Set the maximum length of commit messages
aicommits config set max-length=50

# Set the number of messages to generate (default: 1)
aicommits config set generate=3

# Set the type of commit message (conventional or empty for standard)
aicommits config set type=conventional

# Use branch name as commit message prefix (default: false)
# Automatically extracts Jira/Linear IDs from branch name and uses them as prefix.
aicommits config set use-branch-prefix=true

# Set the timeout for API requests in milliseconds (default: 10000)
aicommits config set timeout=10000

# Set the language for commit messages (default: en)
aicommits config set locale=en
```

## License

MIT © [Rocktim Saikia](https://github.com/rocktimsaikia)
