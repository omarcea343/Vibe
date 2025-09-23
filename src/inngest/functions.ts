import { Sandbox } from "@e2b/code-interpreter";
import { createAgent, createNetwork, createTool, openai } from "@inngest/agent-kit";

import { PROMPT } from "@/prompt";

import { inngest } from "./client";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";

export const helloWorld = inngest.createFunction(
	{ id: "hello-world" },
	{ event: "test/hello.world" },
	async ({ event, step }) => {
		const sandboxId = await step.run("get-sandbox-id", async () => {
			const sandbox = await Sandbox.create("vibe-nextjs-kasump");
			return sandbox.sandboxId;
		});

		const codeAgent = createAgent({
			name: "code-agent",
			description: "An expert coding agent.",
			system: PROMPT,
			model: openai({
				model: "gpt-4.1",
				apiKey: process.env.AI_API_KEY,
				defaultParameters: {
					temperature: 0.1,
				},
			}),
			tools: [
				createTool({
					name: "terminal",
					description:
						"Use the terminal to run commands. Parameters: command (string) - The command to execute in the terminal",
					handler: async ({ command }, { step }) => {
						return await step?.run("terminal", async () => {
							const buffers = { stdout: "", stderr: "" };

							try {
								const sandbox = await getSandbox(sandboxId);
								const result = await sandbox.commands.run(command, {
									onStdout: (data: string) => {
										buffers.stdout += data;
									},
									onStderr: (data: string) => {
										buffers.stderr += data;
									},
								});
								return result.stdout;
							} catch (e) {
								console.error(
									`Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`
								);
								return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
							}
						});
					},
				}),
				createTool({
					name: "createOrUpdateFiles",
					description:
						"Create or update files in the sandbox. Parameters: files (array) - Array of file objects, each containing path (string) - The file path, and content (string) - The file content",
					handler: async ({ files }, { step, network }) => {
						const newFiles = await step?.run("createOrUpdateFiles", async () => {
							try {
								const updatedFiles = network.state.data.files || {};
								const sandbox = await getSandbox(sandboxId);
								for (const file of files) {
									await sandbox.files.write(file.path, file.content);
									updatedFiles[file.path] = file.content;
								}

								return updatedFiles;
							} catch (e) {
								return "Error:" + e;
							}
						});

						if (typeof newFiles === "object") {
							network.state.data.files = newFiles;
						}
					},
				}),
				createTool({
					name: "readFiles",
					description:
						"Read files from the sandbox. Parameters: files (array) - Array of file paths (strings) to read",
					handler: async ({ files }, { step }) => {
						return await step?.run("readFiles", async () => {
							try {
								const sandbox = await getSandbox(sandboxId);
								const contents = [];
								for (const file of files) {
									const content = await sandbox.files.read(file);
									contents.push({ path: file, content });
								}

								return JSON.stringify(contents);
							} catch (e) {
								return "Error: " + e;
							}
						});
					},
				}),
			],
			lifecycle: {
				onResponse: async ({ result, network }) => {
					const lastAssistantMessageText = lastAssistantTextMessageContent(result);

					if (lastAssistantMessageText && network) {
						if (lastAssistantMessageText.includes("<task_summary>")) {
							network.state.data.summary = lastAssistantMessageText;
						}
					}

					return result;
				},
			},
		});

		const network = createNetwork({
			name: "coding-agent-network",
			agents: [codeAgent],
			maxIter: 15,
			router: async ({ network }) => {
				const summary = network.state.data.summary;

				if (summary) {
					return;
				}
				return codeAgent;
			},
		});

		const result = await network.run(event.data.value);

		const sandboxUrl = await step.run("get-sandbox-url", async () => {
			const sandbox = await getSandbox(sandboxId);
			const host = sandbox.getHost(3000);

			return `https://${host}`;
		});

		return {
			url: sandboxUrl,
			title: "Fragment",
			files: result.state.data.files,
			summary: result.state.data.summary,
		};
	}
);
