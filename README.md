# EACC MCP Server

A Model Context Protocol (MCP) server for querying the Effective Acceleration (EACC) marketplace on Arbitrum One. This allows you to ask Claude about jobs, search for opportunities, and get marketplace insights directly through conversation.

## Installation

Install the MCP server globally using npm:

```bash
npm install -g eacc-mcp
```

## Configuration

### Claude Desktop Setup (Windows)

1. Locate your Claude Desktop configuration file at:
   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```

2. Edit the file to add the EACC marketplace server:
   ```json
   {
    "mcpServers": {
     "eacc-marketplace": {
       "command": "npx",
       "args": ["eacc-mcp"]
     }
    }
   }
   ```

3. **Exit and restart Claude Desktop** completely for the changes to take effect.

### Other Platforms

- **macOS**: Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: Claude Desktop does not yet support Linux.

## Usage

Once configured, you can ask Claude natural language questions about the EACC marketplace:

### Example Conversation

**Prompt:**
> how many jobs are on the eacc marketplace?

**Claude's Response:**
> I'll check the current number of jobs on the EACC marketplace for you.
> 
> **Tool Used:** `get_job_count`  
> **Request:** `{}`  
> **Response:** `There are currently 559 jobs on the EACC marketplace.`
> 
> There are currently **559 jobs** on the EACC marketplace.

## Available Queries

You can ask Claude questions like:

- "How many jobs are on the EACC marketplace?"
- "Show me recent jobs"
- "Search for digital video jobs"
- "Find open development jobs"
- "Get details for job #123"

## Available Tools

The MCP server provides these tools to Claude:

- **get_job_count** - Get the total number of jobs on the marketplace
- **search_jobs** - Search for jobs with optional filters (status, category, limit)
- **get_job_details** - Get detailed information about a specific job
- **get_recent_jobs** - Get recently created jobs from the marketplace

## Technical Details

- **Network**: Arbitrum One mainnet
- **Contract**: EACC marketplace smart contract
- **Data Source**: On-chain job data and IPFS metadata
- **Requirements**: Node.js 20+ for installation

## Troubleshooting

### MCP Server Not Available
- Ensure you've restarted Claude Desktop after editing the config
- Verify the config file syntax is valid JSON
- Check that `eacc-mcp` is installed: `npm list -g eacc-mcp`

### Connection Issues
- The server uses public Arbitrum RPC endpoints by default
- Network connectivity to Arbitrum One is required
- Some queries may take a few seconds to complete

## Updates

To update to the latest version:

```bash
npm update -g eacc-mcp
```

Then restart Claude Desktop.

## Support

*This MCP server provides read-only access to marketplace data. No wallet connection or private keys are required.*