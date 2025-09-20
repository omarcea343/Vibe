import { createAgent, openai } from "@inngest/agent-kit";

import { inngest } from "./client";

export const helloWorld = inngest.createFunction(
	{ id: "hello-world" },
	{ event: "test/hello.world" },
	async ({ event }) => {
		const codeAgent = createAgent({
			name: "code-agent",
			system: "You are and expert Next.js developer. You write readable, maintainable, and performant code. You write simple Next.js & React snippers",
			model: openai({
				model: "gpt-5-mini",
				apiKey: process.env.AI_API_KEY,
			}),
		});

		const { output } = await codeAgent.run(`Write the following code snippet: ${event.data.value}`);

		return { output };
	}
);
