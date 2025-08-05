import { MCPClient } from '../../mcp-client/build/index.js';
import { getLLMGenerations } from './generations.js';

export async function getKnowledge(email) {
    const mcpClient = new MCPClient();
    const path = process.env.HOME + '/Desktop/fieldservice-hackathon/robin/mcp-server/build/index.js';
    await mcpClient.connectToServer(path);
    const knowledge = await mcpClient.getKnowledge(email);
    return knowledge;
}

export async function getAnswerInUserContext(question, userEmail) {
    // todo: refine prompt, cleanup question, provide other instructions so that llm replies as user
    const knowledge = await getKnowledge(userEmail);
    const data = knowledge?.content[0]?.text;
    console.log(data);
    const prompt = `
    You are responding to a question asked by someone else, and you're answering as if you're the person whose knowledge is being used.
    Your knowledge and expertise is: ${data}.
    Someone asked: ${question}.
    
    Guidelines for your response:
    - Keep your response under 2-3 short sentences
    - Be direct and to the point
    - Be friendly and helpful, like you're talking to a colleague
    - Avoid technical jargon unless absolutely necessary
    - Don't mention "knowledge base" or technical terms
    - Don't use the word "user" in your answer
    - Don't use any IDs
    - Don't mention that you're using someone else's knowledge
    - Don't url encode the answer
    - Fix url encoding in the answer
    - Answer based on your knowledge and expertise
    - If asked for more details, provide specific information related to the current topic
    - Never respond with general background information unless specifically asked
    - Stay focused on the current topic of discussion
    - If the question is not related to your knowledge, simply say "I don't have information about that in my knowledge base"
    - Never make up or guess information that's not in your knowledge base
    - If someone asks if you're sure, and the information wasn't in your knowledge base, say "I apologize, I don't have that information in my knowledge base"
    - Never provide information about topics not mentioned in your knowledge base
    - If the question contains multiple topics, only answer the parts you have information about
    - When you have specific examples in your knowledge, include them in your response
    - If asked about differences, highlight the key specific differences you know about
    - When asked for more details, stay on the same topic and provide additional specific information
    - Never switch topics unless explicitly asked
    `;
    const answer = await getLLMGenerations(prompt);
    return answer?.generations[0]?.text;
}

export async function getAnswerInDiscussionContext(agenda, userEmail, conversation) {
    const conversationHistory = conversation.map(entry => 
        `${entry.name} said: ${entry.answer}`
    ).join('\n');
    
    const knowledge = await getKnowledge(userEmail);
    const data = knowledge?.content[0]?.text;

    const prompt = `
    You are a helpful assistant that can answer questions about the user's knowledge base.
    There is a discussion going on between the users.
    The user's knowledge base is: ${data}.
    Considering the user's knowledge base, give a helpful answer.
    The conversation so far is: ${conversationHistory}.
    The agenda of the discussion is: ${agenda}.
    Respond to the user's question based on the conversation so far and the agenda.
    Give meaningful answers.
    Don't talk about the user in your answer and instead focus on the answer.
    Generate short and concise answers less than 50 words.
    `;
    console.log(prompt);
    const answer = await getLLMGenerations(prompt);
    return answer?.generations[0]?.text;
}