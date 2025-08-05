import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from 'fs';
import path from 'path';
// Create a logging function
function logToFile(message, type = 'info') {
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
server.tool("get-knowledge", "Get knowledge from the knowledge base of an employee", {
    email: z.string().describe("The email Id of the employee"),
}, async ({ email }) => {
    try {
        // Convert email to a filename-friendly format
        const filename = `${email.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        const filePath = path.join(process.env.HOME || '', '.robin/data', filename);
        logToFile(`Retrieving knowledge base for ${email} from ${filePath}`);
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            return {
                content: [
                    {
                        type: "text",
                        text: fileContent
                    },
                ],
            };
        }
        else {
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
    }
    catch (error) {
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
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logToFile("Knowledge base MCP Server running on stdio");
}
main().catch((error) => {
    logToFile(`Fatal error in main(): ${error}`, 'error');
    process.exit(1);
});
