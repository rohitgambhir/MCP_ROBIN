import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from 'fs';
import path from 'path';

// Create a logging function
function logToFile(message: string, type: 'info' | 'error' = 'info') {
	const timestamp = new Date().toISOString();
	const logMessage = `[MCP Server][${timestamp}] [${type.toUpperCase()}] ${message}\n`;
	const logFile = path.join(process.env.HOME || '', '.robin/logs/mcp-server.log');
	fs.appendFileSync(logFile, logMessage);
}

// Create server instance
const server = new McpServer({
	name: "knowledge-base",
	version: "0.0.1"
});

server.tool(
	"get-knowledge",
	"Get knowledge from the knowledge base of an employee",
	{
		email: z.string().email().describe("The email Id of the employee"),
	},
	async ({ email }: { email: string }) => {
		try {
			// Convert email to a filename-friendly format
			const filename = `${email.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
			const dataDir = path.join(process.env.HOME || '', '.robin/data');
			const filePath = path.join(dataDir, filename);
			
			logToFile(`Retrieving knowledge base for ${email} from ${filePath}`);

			// Check if data directory exists
			if (!fs.existsSync(dataDir)) {
				logToFile(`Data directory does not exist: ${dataDir}`, 'error');
				return {
					content: [
						{
							type: "text",
							text: `Knowledge base system is not properly configured. Please contact support.`,
						},
					],
				};
			}

			if (fs.existsSync(filePath)) {
				try {
					const fileContent = fs.readFileSync(filePath, 'utf8');
					// Validate JSON content
					const parsedContent = JSON.parse(fileContent);
					
					// Basic content validation
					if (typeof parsedContent !== 'object' || parsedContent === null) {
						throw new Error('Invalid knowledge base format');
					}

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(parsedContent, null, 2)
							},
						],
					};
				} catch (parseError) {
					logToFile(`Error parsing knowledge base for ${email}: ${parseError}`, 'error');
					return {
						content: [
							{
								type: "text",
								text: `Error: Knowledge base for ${email} is corrupted. Please contact support.`,
							},
						],
					};
				}
			} else {
				logToFile(`No knowledge base found for ${email}`);
				return {
					content: [
						{
							type: "text",
							text: `No knowledge base found for ${email}. Please make sure the user has set up their AI Assistant through the Slack app.`,
						},
					],
				};
			}
		} catch (error) {
			logToFile(`Error reading knowledge base for ${email}: ${error}`, 'error');
			return {
				content: [
					{
						type: "text",
						text: `Error retrieving knowledge base for ${email}. Please try again later.`,
					},
				],
			};
		}
	},
);

interface ScheduleItem {
	start: {
		dateTime: string;
		timeZone: string;
	};
	end: {
		dateTime: string;
		timeZone: string;
	};
	status: string;
}

interface AvailabilityResponse {
	value: Array<{
		scheduleItems: ScheduleItem[];
	}>;
}

server.tool(
	"get-outlook-availability",
	"Get available times from Microsoft Outlook Calendar",
	{
		email: z.string().describe("The email of the user whose calendar to check"),
		startTime: z.string().describe("Start time in ISO format (e.g., 2024-03-19T09:00:00Z)"),
		endTime: z.string().describe("End time in ISO format (e.g., 2024-03-19T17:00:00Z)"),
		timeZone: z.string().describe("Time zone (e.g., 'UTC', 'America/New_York')").optional(),
	},
	async ({ email, startTime, endTime, timeZone = 'UTC' }) => {
		try {
			// Microsoft Graph API endpoint for calendar availability
			const endpoint = 'https://graph.microsoft.com/v1.0/me/calendar/getSchedule';
			
			// Request body for the API call
			const requestBody = {
				schedules: [email],
				startTime: {
					dateTime: startTime,
					timeZone: timeZone
				},
				endTime: {
					dateTime: endTime,
					timeZone: timeZone
				},
				availabilityViewInterval: 30 // 30-minute intervals
			};

			// Make the API call to Microsoft Graph
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${process.env.MICROSOFT_GRAPH_TOKEN}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				throw new Error(`Microsoft Graph API error: ${response.statusText}`);
			}

			const data = await response.json() as AvailabilityResponse;
			
			// Process and format the availability data
			const availability = data.value[0].scheduleItems.map((item: ScheduleItem) => ({
				start: item.start.dateTime,
				end: item.end.dateTime,
				status: item.status
			}));

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(availability, null, 2)
					}
				]
			};
		} catch (error) {
			logToFile(`Error getting Outlook availability for ${email}: ${error}`, 'error');
			return {
				content: [
					{
						type: "text",
						text: `Error retrieving Outlook availability for ${email}. Please ensure the Microsoft Graph token is valid and the user has granted calendar access.`
					}
				]
			};
		}
	}
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	logToFile("Knowledge base MCP Server running on stdio");
}

main().catch((error) => {
	logToFile(`Fatal error in main(): ${error}`, 'error');
	process.exit(1);
});