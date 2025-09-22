import { Sandbox } from "@e2b/code-interpreter";
import { createAgent, openai } from "@inngest/agent-kit";

import { inngest } from "./client";
import { getSandbox } from "./utils";

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
			system: "You are and expert Next.js developer. You write readable, maintainable, and performant code. You write simple Next.js & React snippers",
			model: openai({
				model: "gpt-5-mini",
				apiKey: process.env.AI_API_KEY,
			}),
		});

		const { output } = await codeAgent.run(`Write the following code snippet: ${event.data.value}`);

		const sandboxUrl = await step.run("get-sandbox-url", async () => {
			const sandbox = await getSandbox(sandboxId);
			const host = sandbox.getHost(3000);

			return `https://${host}`;
		});

		return { output, sandboxUrl };
	}
);
