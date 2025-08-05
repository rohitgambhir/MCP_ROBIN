import { spawn } from 'child_process';
async function main() {
    // Start the server process
    const serverProcess = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    // Create request
    const request = {
        jsonrpc: '2.0',
        id: '1',
        method: 'tools/get-knowledge',
        params: {
            email: 'test@example.com'
        }
    };
    // Send request to server
    if (serverProcess.stdin) {
        serverProcess.stdin.write(JSON.stringify(request) + '\n');
    }
    // Handle response
    if (serverProcess.stdout) {
        serverProcess.stdout.on('data', (data) => {
            console.log('Response:', data.toString());
        });
    }
    // Handle errors
    if (serverProcess.stderr) {
        serverProcess.stderr.on('data', (data) => {
            console.error('Error:', data.toString());
        });
    }
    // Clean up after 5 seconds
    setTimeout(() => {
        serverProcess.kill();
    }, 5000);
}
main().catch(console.error);
