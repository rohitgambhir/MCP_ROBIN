import bolt from '@slack/bolt';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getAnswerInUserContext, getAnswerInDiscussionContext } from './util.js';
import { threadId } from 'worker_threads';

// Load environment variables
dotenv.config();

// Initialize your app with your bot token and signing secret
const app = new bolt.App({
	token: process.env.SLACK_BOT_TOKEN,
	signingSecret: process.env.SLACK_SIGNING_SECRET,
	appToken: process.env.SLACK_APP_TOKEN,
	socketMode: true
});

const SAY_NUMBER = 3;

// Listen for messages
app.message(async ({ message, say, logger, event, client }) => {
    try {
        console.log('Message content:', message);

        // Check for user mentions in the message
        const userMentions = message.text?.match(/<@([A-Z0-9]+)>/g);
        logger.info(`Processing message: "${message.text}"`);
        logger.info(`Found ${userMentions ? userMentions.length : 0} user mentions`);

        if (userMentions) {
            // todo: handle multiple mentions and decide if should send multiple response or combine them
            for (const mention of userMentions) {
                const userId = mention.match(/<@([A-Z0-9]+)>/)[1];
                if (userId === process.env.SLACK_BOT_USER_ID) {
                    continue;
                }
                logger.info(`Processing mention for user ID: ${userId}`);
                try {
                    // Get user info including email
                    const userInfo = await client.users.info({
                        user: userId,
                        include_locale: true
                    });
                                        
                    // Check for email in both profile and real_name fields
                    const userEmail = userInfo.user.profile.email;
                    if (userEmail) {
                        logger.info(`Found user ${userInfo.user.name} with email/name: ${userEmail}`);
                        // You can use the email here for further processing
                        logger.info('Generating answer in user context...');
                        const answer = await getAnswerInUserContext(message.text, userEmail);
                        logger.info('Answer generated successfully');
                        logger.info('Sending response to Slack...');
                        await client.chat.postMessage({
                            text: answer,
                            channel: event.channel,
                            thread_ts: message.thread_ts || message.ts, // Use existing thread or create new one
                            parse: 'full', // Enable parsing of mentions, links, and other formatting
                            unfurl_links: true, // Enable link previews
                            unfurl_media: true // Enable media previews
                        });
                        logger.info('Response sent successfully');
                    } else {
                        logger.warn(`No email found for user ${userInfo.user.name}`);
                    }
                } catch (error) {
                    logger.error(`Error processing user ${userId}:`, error);
                    if (error.response) {
                        logger.error('API Response:', error.response.data);
                    }
                }
            }
        } else {
            logger.info('No user mentions found in message');
        }
    } catch (error) {
        logger.error('Error handling message:', error);
    }
});

app.event('app_home_opened', async ({ event, client, logger }) => {
	try {
		console.log('App home opened.');
		// Call views.publish with the built-in client
		const result = await client.views.publish({
			// Use the user ID associated with the event
			user_id: event.user,
			view: {
				// Home tabs must be enabled in your app configuration page under "App Home"
				type: 'home',
				blocks: [
					{
						type: 'header',
						text: {
							type: 'plain_text',
							text: 'Setup your AI Assistant!',
							emoji: true,
						},
					},
					{
						type: 'divider',
					},
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: 'Click on the button below to help us train your AI Assistant.',
						},
					},
					{
						type: 'actions',
						elements: [
							{
								type: 'button',
								text: {
									type: 'plain_text',
									text: "Let's get started!",
									emoji: true
								},
								style: 'primary',
								action_id: 'view_knowledge_bank'
							}
						]
					},
					{
						type: 'divider',
					},
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: 'Start a discussion with your team members.',
						},
					},
					{
						type: 'actions',
						elements: [
							{
								type: 'button',
								text: {
									type: 'plain_text',
									text: 'Start Discussion',
									emoji: true
								},
								style: 'primary',
								action_id: 'start_discussion'
							}
						]
					}
				],
			},
		});
	} catch (error) {
		logger.error(error)
	}
});

// Handle enroll button click
app.action('view_knowledge_bank', async ({ ack, body, client }) => {
    try {
        // Acknowledge the action
        await ack();
        
        // Check for existing data
        const dataDir = path.join(process.env.HOME, '.robin', 'data');
        const filePath = path.join(dataDir, `${body.user.id}.json`);
        let existingData = {};
        
        if (fs.existsSync(filePath)) {
            try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                existingData = JSON.parse(fileContent);
            } catch (error) {
                console.error('Error reading existing data:', error);
            }
        }
        
        // Open a modal
        await client.views.open({
            trigger_id: body.trigger_id,
            view: {
                type: 'modal',
                callback_id: 'knowledge_bank_modal',
                title: {
                    type: 'plain_text',
                    text: 'Setup your AI Assistant',
                    emoji: true
                },
                submit: {
                    type: 'plain_text',
                    text: 'Save',
                    emoji: true
                },
                close: {
                    type: 'plain_text',
                    text: 'Close',
                    emoji: true
                },
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: 'Help us train your AI Assistant by providing some information about yourself.'
                        }
                    },
                    {
                        type: 'divider'
                    },
                    {
                        type: 'input',
                        block_id: 'ai_assistant_name',
                        element: {
                            type: 'plain_text_input',
                            action_id: 'name',
                            placeholder: {
                                type: 'plain_text',
                                text: 'Robin'
                            },
                            initial_value: existingData.assistant_name || ''
                        },
                        label: {
                            type: 'plain_text',
                            text: 'What would you like to call your AI Assistant?',
                            emoji: true
                        }
                    },
                    {
                        type: 'input',
                        block_id: 'links',
                        element: {
                            type: 'plain_text_input',
                            action_id: 'links',
                            multiline: true,
                            placeholder: {
                                type: 'plain_text',
                                text: 'Paste your links here'
                            },
                            initial_value: existingData.links || ''
                        },
                        label: {
                            type: 'plain_text',
                            text: 'Add any links or documents that will help us know you better',
                            emoji: true
                        }
                    },
                    {
                        type: 'input',
                        block_id: 'additional_info',
                        element: {
                            type: 'plain_text_input',
                            action_id: 'additional_info',
                            multiline: true,
                            placeholder: {
                                type: 'plain_text',
                                text: 'Write anything noteworthy about yourself'
                            },
                            initial_value: existingData.additional_info || ''
                        },
                        label: {
                            type: 'plain_text',
                            text: 'Add any additional information that will help us train your AI Assistant',
                            emoji: true
                        }
                    }
                ]
            }
        });
    } catch (error) {
        console.error('Error opening modal:', error);
    }
});

// Handle modal submission
app.view('knowledge_bank_modal', async ({ ack, body, view, client }) => {
    try {
        // Acknowledge the view submission
        await ack();
        
        // Get the submitted values
        const values = view.state.values;
        const name = values.ai_assistant_name.name.value;
        const links = values.links.links.value;
        const additional_info = values.additional_info.additional_info.value;
        
        // Get user info from Slack
        const userInfo = await client.users.info({
            user: body.user.id
        });
        
        const displayName = userInfo.user.profile.display_name || userInfo.user.profile.real_name || userInfo.user.name;
        
        // Create data directory if it doesn't exist
        const dataDir = path.join(process.env.HOME, '.robin', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }

        // File path for this user
        const filePath = path.join(dataDir, `${body.user.id}.json`);
        
        // Read existing data if file exists
        let existingData = {};
        if (fs.existsSync(filePath)) {
            try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                existingData = JSON.parse(fileContent);
            } catch (error) {
                console.error('Error reading existing data:', error);
            }
        }

        // Create updated data object
        const userData = {
            ...existingData,
            assistant_name: name,
            links: links,
            additional_info: additional_info,
            display_name: displayName,
            slack_id: body.user.id,
            updated_at: new Date().toISOString()
        };

        // Save to JSON file
        fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
        
        console.log('User data saved:', { userId: body.user.id, ...userData });
        
        // Send a confirmation message to the user
        await client.chat.postMessage({
            channel: body.user.id,
            text: `Thanks for updating your AI Assistant, ${displayName}! Your preferences have been saved.`
        });
    } catch (error) {
        console.error('Error handling modal submission:', error);
    }
});

// Shared function to open discussion modal
async function openDiscussionModal(client, triggerId) {
    return await client.views.open({
        trigger_id: triggerId,
        view: {
            type: 'modal',
            callback_id: 'discussion_modal',
            title: {
                type: 'plain_text',
                text: 'Start a Discussion',
                emoji: true
            },
            submit: {
                type: 'plain_text',
                text: 'Start Discussion',
                emoji: true
            },
            close: {
                type: 'plain_text',
                text: 'Cancel',
                emoji: true
            },
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: 'Select users to include in the discussion and enter your agenda.'
                    }
                },
                {
                    type: 'divider'
                },
                {
                    type: 'input',
                    block_id: 'users',
                    element: {
                        type: 'multi_users_select',
                        action_id: 'users',
                        placeholder: {
                            type: 'plain_text',
                            text: 'Select users',
                            emoji: true
                        }
                    },
                    label: {
                        type: 'plain_text',
                        text: 'Select Users',
                        emoji: true
                    }
                },
                {
                    type: 'input',
                    block_id: 'message',
                    element: {
                        type: 'plain_text_input',
                        action_id: 'message',
                        multiline: true,
                        placeholder: {
                            type: 'plain_text',
                            text: 'Enter your agenda in the form of a list here'
                        }
                    },
                    label: {
                        type: 'plain_text',
                        text: 'Agenda',
                        emoji: true
                    }
                }
            ]
        }
    });
}

// Handle discussion button click from app home
app.action('start_discussion', async ({ ack, body, client }) => {
    try {
        // Acknowledge the action
        await ack();
        await openDiscussionModal(client, body.trigger_id);
    } catch (error) {
        console.error('Error opening discussion modal:', error);
    }
});

// Handle /discussion command
app.command('/discussion', async ({ ack, body, client }) => {
    try {
        // Acknowledge the command request
        await ack();
        await openDiscussionModal(client, body.trigger_id);
    } catch (error) {
        console.error('Error opening discussion modal:', error);
    }
});

// Handle discussion modal submission
app.view('discussion_modal', async ({ ack, body, view, client, logger }) => {
    try {
        // Acknowledge the view submission
        await ack();
        
        // Get the submitted values
        const values = view.state.values;
        const selectedUsers = values.users.users.selected_users;
        const message = values.message.message.value;
        
        // Create a thread with the selected users
        const result = await client.chat.postMessage({
            channel: body.user.id,
            text: `Discussion started with: ${selectedUsers.map(user => `<@${user}>`).join(', ')}\n\Agenda:\n${message}`,
            thread_ts: body.message?.ts,
        });
        // trigger the discussion
        triggerDiscussion(selectedUsers, message, client, logger, result.channel, result.ts);
    } catch (error) {
        console.error('Error handling discussion modal submission:', error);
    }
});

async function triggerDiscussion(userIds, agendaText, client, logger, channel, thread) {
    logger.info('Extracted user IDs:', userIds);
    logger.info('Extracted agenda:', agendaText);

    // Get emails for all users 
    const userEmails = [];
    const userMapping = {}; // New mapping object to store user details

    for (const userId of userIds) {
        try {
            const userInfo = await client.users.info({
                user: userId,
                include_locale: true
            });
            if (userInfo.user.profile.email) {
                userEmails.push(userInfo.user.profile.email);
                // Store user details in the mapping
                userMapping[userId] = {
                    email: userInfo.user.profile.email,
                    name: userInfo.user.real_name || userInfo.user.name,
                    displayName: userInfo.user.profile.display_name || userInfo.user.real_name || userInfo.user.name
                };
                logger.info(`Processed user: ${userInfo.user.real_name} (${userInfo.user.profile.email})`);
            }
        } catch (error) {
            logger.error(`Error fetching info for user ${userId}:`, error);
        }
    }

    // Get answers for each user SAY_NUMBER times
    const conversationSoFar = [];
    for (let i = 0; i < SAY_NUMBER; i++) {
        for (const userId of userIds) {
            try {
                const userEmail = userMapping[userId].email;
                const answer = await getAnswerInDiscussionContext(agendaText, userEmail, conversationSoFar);
                conversationSoFar.push({
                    email: userEmail,
                    name: userMapping[userId].name,
                    answer,
                    iteration: i + 1
                });
                logger.info(`Got answer for user ${userId} (iteration ${i + 1})`);
                logger.info('Sending response to Slack...');
                await client.chat.postMessage({
                    icon_emoji: ":robot_face:",
                    text: `${answer}`,
                    channel: channel,
                    thread_ts: thread,
                    username: userMapping[userId].displayName
                });
                logger.info('Response sent successfully');
            } catch (error) {
                logger.error(`Error getting answer for user ${userId} (iteration ${i + 1}):`, error);
            }
        }
    }
}

// Start your app
(async () => {
	try {
		const port = process.env.PORT || 3000;
		await app.start(port);
		console.log(`⚡️ Bolt app is running on port ${port}!`);
		
		// Verify bot connection and get bot user ID
		const result = await app.client.auth.test();
		console.log('Bot connected as:', result.user);
		console.log('Bot is in team:', result.team);
		console.log('Bot User ID:', result.user_id);
		
		// List all channels the bot is in
		const channels = await app.client.conversations.list({
			types: 'public_channel,private_channel'
		});
		console.log('Bot is in channels:', channels.channels.map(c => c.name));
	} catch (error) {
		console.error('Error starting app:', error);
		process.exit(1);
	}
})(); 